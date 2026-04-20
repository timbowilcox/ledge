"use client";

// ---------------------------------------------------------------------------
// Record Payment Modal — records a payment against an existing invoice.
// Extracted from invoices-view.tsx.
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import { recordPaymentAction } from "@/lib/actions";
import type { InvoiceListItem } from "@/lib/actions";
import {
  todayISO,
  dollarsToCents,
  centsToDollars,
  labelStyle,
  inputStyle,
} from "./_shared";

export function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: InvoiceListItem;
  onClose: () => void;
  onRecorded: (updated: InvoiceListItem | null) => void;
}) {
  const [amountDollars, setAmountDollars] = useState(centsToDollars(invoice.amountDue));
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const amountCents = dollarsToCents(amountDollars);
  const isValid = amountCents > 0 && amountCents <= invoice.amountDue && paymentDate;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const actionResult = await recordPaymentAction(invoice.id, {
          amount: amountCents,
          paymentDate,
          paymentMethod: paymentMethod || undefined,
          reference: reference || undefined,
        });
        if (!actionResult.ok) {
          setError(actionResult.error.type === "tier_limit"
            ? `${actionResult.error.message}. Upgrade your plan to continue.`
            : actionResult.error.message);
          return;
        }
        if (!actionResult.data) {
          setError("Failed to record payment.");
          return;
        }
        onRecorded(actionResult.data);
      } catch (e) {
        console.error("[record-payment] failed:", e);
        setError("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, backgroundColor: "var(--surface-1)", borderRadius: 8, border: "1px solid var(--border)", zIndex: 201, padding: 24 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Record Payment</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "none", borderRadius: 6, color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16 }}>&#10005;</button>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Invoice {invoice.invoiceNumber} &middot; {invoice.customerName} &middot; Due: {formatCurrency(invoice.amountDue)}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Amount</label>
          <div style={{ display: "flex" }}>
            <span style={{ height: 36, padding: "0 10px", display: "flex", alignItems: "center", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "6px 0 0 6px", fontSize: 13, color: "var(--text-tertiary)" }}>$</span>
            <input
              style={{ ...inputStyle, borderRadius: "0 6px 6px 0", fontFamily: "var(--font-mono)" }}
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Payment date</label>
          <input type="date" style={inputStyle} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Payment method</label>
          <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="stripe">Stripe</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Reference</label>
          <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref or payment ID" />
        </div>

        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 6, backgroundColor: "rgba(239,68,68,0.1)", color: "var(--negative)", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <div className="flex justify-end" style={{ gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!isValid || isPending} onClick={handleSubmit}>
            {isPending ? "Recording..." : "Record payment"}
          </button>
        </div>
      </div>
    </>
  );
}
