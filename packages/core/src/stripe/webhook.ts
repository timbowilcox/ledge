// ---------------------------------------------------------------------------
// Stripe webhook event handling — process charge, refund, and payout events
// into double-entry ledger transactions.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database } from "../db/database.js";
import type { LedgerEngine } from "../engine/index.js";
import { generateId, nowUtc } from "../engine/id.js";
import type {
  StripeConnection,
  StripeChargeData,
  StripeRefundData,
  StripePayoutData,
} from "./types.js";
import { findAccountByCode } from "./accounts.js";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe webhook signature (v1 scheme).
 * Returns true if the signature is valid.
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string,
  tolerance = 300, // 5 minutes
): boolean => {
  const elements = signature.split(",");
  const timestampStr = elements.find((e) => e.startsWith("t="))?.slice(2);
  const signatures = elements
    .filter((e) => e.startsWith("v1="))
    .map((e) => e.slice(3));

  if (!timestampStr || signatures.length === 0) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  // Compare against all provided v1 signatures
  const expectedBuf = Buffer.from(expected, "hex");
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  });
};

// ---------------------------------------------------------------------------
// Event deduplication
// ---------------------------------------------------------------------------

/** Check if a Stripe event has already been processed. */
const isEventProcessed = async (
  db: Database,
  connectionId: string,
  stripeEventId: string,
): Promise<boolean> => {
  const row = await db.get<{ id: string }>(
    `SELECT id FROM stripe_events WHERE connection_id = ? AND stripe_event_id = ?`,
    [connectionId, stripeEventId],
  );
  return !!row;
};

/** Record a processed event. */
const recordEvent = async (
  db: Database,
  connectionId: string,
  stripeEventId: string,
  eventType: string,
  ledgerTransactionId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  await db.run(
    `INSERT INTO stripe_events
      (id, connection_id, stripe_event_id, event_type, processed_at, ledger_transaction_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      connectionId,
      stripeEventId,
      eventType,
      nowUtc(),
      ledgerTransactionId,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
};

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

/**
 * Route a Stripe event to the appropriate handler.
 * Returns the ledger transaction ID if a transaction was created.
 */
export const handleEvent = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  event: { id: string; type: string; data: { object: unknown } },
): Promise<string | null> => {
  switch (event.type) {
    case "charge.succeeded":
      return handleChargeSucceeded(
        db,
        engine,
        connection,
        event.id,
        event.data.object as StripeChargeData,
      );
    case "charge.refunded":
      return handleChargeRefunded(
        db,
        engine,
        connection,
        event.id,
        event.data.object as StripeRefundData,
      );
    case "payout.paid":
      return handlePayoutPaid(
        db,
        engine,
        connection,
        event.id,
        event.data.object as StripePayoutData,
      );
    default:
      // Unhandled event type — log and skip
      console.log(`Unhandled Stripe event type: ${event.type}`);
      return null;
  }
};

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle charge.succeeded:
 * 1. Debit 1050 Stripe Balance (asset) — gross amount
 * 2. Credit 4000 Revenue (or first revenue account) — gross amount
 * 3. If fee > 0: Debit 5200 Processing Fees, Credit 1050 Stripe Balance
 */
export const handleChargeSucceeded = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  stripeEventId: string,
  charge: StripeChargeData,
): Promise<string | null> => {
  // Dedup check
  if (await isEventProcessed(db, connection.id, stripeEventId)) return null;

  const ledgerId = connection.ledgerId;

  // Verify required accounts exist by code
  const stripeBalanceExists = await findAccountByCode(db, ledgerId, "1050");
  const feeAccountExists = await findAccountByCode(db, ledgerId, "5200");

  // Find any revenue account code (prefer 4000, fallback to first revenue)
  let revenueCode = "4000";
  const rev4000 = await findAccountByCode(db, ledgerId, "4000");
  if (!rev4000) {
    const revenueAcct = await db.get<{ code: string }>(
      `SELECT code FROM accounts WHERE ledger_id = ? AND type = 'revenue' AND status = 'active' ORDER BY code LIMIT 1`,
      [ledgerId],
    );
    if (revenueAcct) revenueCode = revenueAcct.code;
    else {
      console.error("No revenue account found for charge processing", { ledgerId });
      return null;
    }
  }

  if (!stripeBalanceExists) {
    console.error("Missing Stripe Balance (1050) account", { ledgerId });
    return null;
  }

  const grossAmount = charge.amount;
  const fee = charge.balanceTransaction?.fee ?? 0;
  const customerEmail = charge.customerEmail ?? "unknown";
  const today = new Date().toISOString().slice(0, 10);

  // Build revenue transaction lines using accountCode
  const revenueLines = [
    { accountCode: "1050", amount: grossAmount, direction: "debit" as const },
    { accountCode: revenueCode, amount: grossAmount, direction: "credit" as const },
  ];

  const revenueResult = await engine.postTransaction({
    ledgerId,
    date: today,
    memo: `Stripe charge from ${customerEmail}`,
    lines: revenueLines,
    sourceType: "import",
    sourceRef: `stripe:charge:${charge.id}`,
    idempotencyKey: `stripe_charge_${charge.id}`,
    metadata: {
      stripeChargeId: charge.id,
      customerEmail,
      description: charge.description,
    },
  });

  if (!revenueResult.ok) {
    console.error("Failed to post Stripe charge transaction:", revenueResult.error);
    return null;
  }

  const txnId = revenueResult.value.id;

  // Post fee transaction if applicable
  if (fee > 0 && feeAccountExists) {
    const feeLines = [
      { accountCode: "5200", amount: fee, direction: "debit" as const },
      { accountCode: "1050", amount: fee, direction: "credit" as const },
    ];

    const feeResult = await engine.postTransaction({
      ledgerId,
      date: today,
      memo: `Stripe processing fee for charge ${charge.id}`,
      lines: feeLines,
      sourceType: "import",
      sourceRef: `stripe:fee:${charge.id}`,
      idempotencyKey: `stripe_fee_${charge.id}`,
      metadata: { stripeChargeId: charge.id, feeAmount: fee },
    });

    if (!feeResult.ok) {
      console.error("Failed to post Stripe fee transaction:", feeResult.error);
    }
  }

  // Record event
  await recordEvent(db, connection.id, stripeEventId, "charge.succeeded", txnId, {
    chargeId: charge.id,
    amount: grossAmount,
    fee,
    customerEmail,
  });

  return txnId;
};

/**
 * Handle charge.refunded:
 * Debit 4100 Refunds (contra-revenue) — refund amount
 * Credit 1050 Stripe Balance — refund amount
 */
export const handleChargeRefunded = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  stripeEventId: string,
  refund: StripeRefundData,
): Promise<string | null> => {
  if (await isEventProcessed(db, connection.id, stripeEventId)) return null;

  const ledgerId = connection.ledgerId;
  const stripeBalanceExists = await findAccountByCode(db, ledgerId, "1050");
  const refundsAccountExists = await findAccountByCode(db, ledgerId, "4100");

  if (!stripeBalanceExists || !refundsAccountExists) {
    console.error("Missing required accounts for refund processing", { ledgerId });
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  const lines = [
    { accountCode: "4100", amount: refund.amount, direction: "debit" as const },
    { accountCode: "1050", amount: refund.amount, direction: "credit" as const },
  ];

  const result = await engine.postTransaction({
    ledgerId,
    date: today,
    memo: `Stripe refund for charge ${refund.chargeId}`,
    lines,
    sourceType: "import",
    sourceRef: `stripe:refund:${refund.id}`,
    idempotencyKey: `stripe_refund_${refund.id}`,
    metadata: {
      stripeRefundId: refund.id,
      stripeChargeId: refund.chargeId,
      reason: refund.reason,
    },
  });

  if (!result.ok) {
    console.error("Failed to post Stripe refund transaction:", result.error);
    return null;
  }

  await recordEvent(db, connection.id, stripeEventId, "charge.refunded", result.value.id, {
    refundId: refund.id,
    chargeId: refund.chargeId,
    amount: refund.amount,
  });

  return result.value.id;
};

/**
 * Handle payout.paid:
 * Debit 1000 Cash/primary bank account (asset)
 * Credit 1050 Stripe Balance — payout amount
 */
export const handlePayoutPaid = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  stripeEventId: string,
  payout: StripePayoutData,
): Promise<string | null> => {
  if (await isEventProcessed(db, connection.id, stripeEventId)) return null;

  const ledgerId = connection.ledgerId;
  const stripeBalanceExists = await findAccountByCode(db, ledgerId, "1050");

  // Find primary cash account code (prefer 1000, fallback to first asset)
  let cashCode = "1000";
  const cash1000 = await findAccountByCode(db, ledgerId, "1000");
  if (!cash1000) {
    const cashAcct = await db.get<{ code: string }>(
      `SELECT code FROM accounts WHERE ledger_id = ? AND type = 'asset' AND code < '1050' AND status = 'active' ORDER BY code LIMIT 1`,
      [ledgerId],
    );
    if (cashAcct) cashCode = cashAcct.code;
    else {
      console.error("No cash account found for payout processing", { ledgerId });
      return null;
    }
  }

  if (!stripeBalanceExists) {
    console.error("Missing Stripe Balance (1050) account for payout processing", { ledgerId });
    return null;
  }

  const arrivalDate = new Date(payout.arrivalDate * 1000).toISOString().slice(0, 10);

  const lines = [
    { accountCode: cashCode, amount: payout.amount, direction: "debit" as const },
    { accountCode: "1050", amount: payout.amount, direction: "credit" as const },
  ];

  const result = await engine.postTransaction({
    ledgerId,
    date: arrivalDate,
    memo: `Stripe payout ${payout.description ?? payout.id}`,
    lines,
    sourceType: "import",
    sourceRef: `stripe:payout:${payout.id}`,
    idempotencyKey: `stripe_payout_${payout.id}`,
    metadata: {
      stripePayoutId: payout.id,
      arrivalDate,
    },
  });

  if (!result.ok) {
    console.error("Failed to post Stripe payout transaction:", result.error);
    return null;
  }

  await recordEvent(db, connection.id, stripeEventId, "payout.paid", result.value.id, {
    payoutId: payout.id,
    amount: payout.amount,
    arrivalDate,
  });

  return result.value.id;
};
