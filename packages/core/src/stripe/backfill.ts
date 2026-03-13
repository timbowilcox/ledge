// ---------------------------------------------------------------------------
// Stripe backfill — fetch historical charges and payouts from the Stripe API.
// ---------------------------------------------------------------------------

import type { Database } from "../db/database.js";
import type { LedgerEngine } from "../engine/index.js";
import type { StripeConnection, StripeChargeData, StripePayoutData } from "./types.js";
import { handleChargeSucceeded, handlePayoutPaid } from "./webhook.js";
import { updateLastSynced } from "./connection.js";

// ---------------------------------------------------------------------------
// Stripe API helpers
// ---------------------------------------------------------------------------

interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

const stripeGet = async <T>(
  accessToken: string,
  path: string,
  params: Record<string, string>,
): Promise<StripeListResponse<T>> => {
  const qs = new URLSearchParams(params);
  const url = `https://api.stripe.com/v1${path}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error: ${res.status} ${text}`);
  }

  return res.json() as Promise<StripeListResponse<T>>;
};

// ---------------------------------------------------------------------------
// Backfill functions
// ---------------------------------------------------------------------------

/**
 * Backfill charges from the last N days.
 * Processes in batches of 100 using Stripe pagination.
 */
export const backfillCharges = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  days = 90,
): Promise<{ processed: number; skipped: number }> => {
  const sinceTimestamp = Math.floor((Date.now() - days * 86_400_000) / 1000);
  let processed = 0;
  let skipped = 0;
  let startingAfter: string | undefined;

  while (true) {
    const params: Record<string, string> = {
      limit: "100",
      "created[gte]": String(sinceTimestamp),
      status: "succeeded",
    };
    if (startingAfter) params["starting_after"] = startingAfter;

    let response: StripeListResponse<{
      id: string;
      amount: number;
      currency: string;
      description: string | null;
      receipt_email: string | null;
      application_fee_amount: number | null;
      balance_transaction: { fee: number; net: number } | string | null;
      metadata: Record<string, string>;
    }>;

    try {
      response = await stripeGet(connection.accessToken, "/charges", params);
    } catch (e) {
      console.error("Error fetching Stripe charges:", e);
      break;
    }

    for (const charge of response.data) {
      const chargeData: StripeChargeData = {
        id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        description: charge.description,
        customerEmail: charge.receipt_email,
        applicationFeeAmount: charge.application_fee_amount,
        balanceTransaction:
          charge.balance_transaction && typeof charge.balance_transaction === "object"
            ? { fee: charge.balance_transaction.fee, net: charge.balance_transaction.net }
            : null,
        metadata: charge.metadata ?? {},
      };

      // Generate a synthetic event ID for backfilled charges
      const eventId = `backfill_charge_${charge.id}`;
      const result = await handleChargeSucceeded(db, engine, connection, eventId, chargeData);
      if (result) {
        processed++;
      } else {
        skipped++;
      }

      startingAfter = charge.id;
    }

    if (!response.has_more || response.data.length === 0) break;
  }

  return { processed, skipped };
};

/**
 * Backfill payouts from the last N days.
 * Processes in batches of 100 using Stripe pagination.
 */
export const backfillPayouts = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  days = 90,
): Promise<{ processed: number; skipped: number }> => {
  const sinceTimestamp = Math.floor((Date.now() - days * 86_400_000) / 1000);
  let processed = 0;
  let skipped = 0;
  let startingAfter: string | undefined;

  while (true) {
    const params: Record<string, string> = {
      limit: "100",
      "created[gte]": String(sinceTimestamp),
      status: "paid",
    };
    if (startingAfter) params["starting_after"] = startingAfter;

    let response: StripeListResponse<{
      id: string;
      amount: number;
      arrival_date: number;
      description: string | null;
    }>;

    try {
      response = await stripeGet(connection.accessToken, "/payouts", params);
    } catch (e) {
      console.error("Error fetching Stripe payouts:", e);
      break;
    }

    for (const payout of response.data) {
      const payoutData: StripePayoutData = {
        id: payout.id,
        amount: payout.amount,
        arrivalDate: payout.arrival_date,
        description: payout.description,
      };

      const eventId = `backfill_payout_${payout.id}`;
      const result = await handlePayoutPaid(db, engine, connection, eventId, payoutData);
      if (result) {
        processed++;
      } else {
        skipped++;
      }

      startingAfter = payout.id;
    }

    if (!response.has_more || response.data.length === 0) break;
  }

  return { processed, skipped };
};

/**
 * Backfill all — charges then payouts.
 */
export const backfillAll = async (
  db: Database,
  engine: LedgerEngine,
  connection: StripeConnection,
  days = 90,
): Promise<{ charges: { processed: number; skipped: number }; payouts: { processed: number; skipped: number } }> => {
  const charges = await backfillCharges(db, engine, connection, days);
  const payouts = await backfillPayouts(db, engine, connection, days);
  await updateLastSynced(db, connection.id);
  return { charges, payouts };
};
