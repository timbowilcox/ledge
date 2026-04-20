// ---------------------------------------------------------------------------
// Shared helpers, constants, and sub-components for the invoices route.
//
// Split out of the original 1,442-line invoices-view.tsx so the main container,
// the create/edit modal, the detail drawer, and the record-payment modal can
// each live in their own file while reusing this.
// ---------------------------------------------------------------------------

import type React from "react";

// ---------------------------------------------------------------------------
// Date + money helpers
// ---------------------------------------------------------------------------

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function plus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function dollarsToCents(dollars: string): number {
  return Math.round(parseFloat(dollars || "0") * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "rgba(113,113,122,0.12)", text: "var(--text-tertiary)" },
  approved: { bg: "rgba(20,184,166,0.12)", text: "#14b8a6" },
  sent: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  overdue: { bg: "rgba(239,68,68,0.12)", text: "var(--negative)" },
  partially_paid: { bg: "rgba(245,158,11,0.12)", text: "#D97706" },
  paid: { bg: "rgba(34,197,94,0.12)", text: "var(--positive)" },
  void: { bg: "rgba(113,113,122,0.08)", text: "var(--text-disabled)" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  const label = status === "partially_paid"
    ? "Partial"
    : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        backgroundColor: c!.bg,
        color: c!.text,
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

export function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: warn ? "var(--warning)" : "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-tertiary)",
  fontWeight: 500,
  marginBottom: 6,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
};

// ---------------------------------------------------------------------------
// Payment terms options (shared between create modal and detail views)
// ---------------------------------------------------------------------------

export const PAYMENT_TERMS_OPTIONS = [
  { code: "due_on_receipt", label: "Due on receipt" },
  { code: "net_7", label: "Net 7" },
  { code: "net_14", label: "Net 14" },
  { code: "net_15", label: "Net 15" },
  { code: "net_30", label: "Net 30" },
  { code: "net_45", label: "Net 45" },
  { code: "net_60", label: "Net 60" },
  { code: "net_90", label: "Net 90" },
];
