"use client";

// ---------------------------------------------------------------------------
// Invoice Detail Drawer — right-side panel showing full invoice details,
// payment history, and action buttons. Extracted from invoices-view.tsx.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceListItem } from "@/lib/actions";
import { StatusBadge } from "./_shared";

export function InvoiceDetailDrawer({
  invoice,
  isPending,
  onClose,
  onSend,
  onEmailInvoice,
  onVoid,
  onDelete,
  onEdit,
  onRecordPayment,
  onDownloadPDF,
  onPreviewPDF,
}: {
  invoice: InvoiceListItem;
  isPending: boolean;
  onClose: () => void;
  onSend: (sendEmail: boolean) => void;
  onEmailInvoice: () => void;
  onVoid: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRecordPayment: () => void;
  onDownloadPDF: () => void;
  onPreviewPDF: () => void;
}) {
  const isDraft = invoice.status === "draft";
  const isApproved = invoice.status === "approved";
  const canPay = ["approved", "sent", "overdue", "partially_paid"].includes(invoice.status);
  const canVoid = ["approved", "sent", "overdue"].includes(invoice.status);
  const isTerminal = ["paid", "void"].includes(invoice.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 100 }}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 520,
          backgroundColor: "var(--surface-1)", borderLeft: "1px solid var(--border)",
          zIndex: 101, overflowY: "auto", padding: 24,
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <div className="flex items-center" style={{ gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{invoice.invoiceNumber}</span>
              <StatusBadge status={invoice.status} />
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{invoice.customerName}</div>
            {invoice.customerEmail && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{invoice.customerEmail}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "transparent", border: "none", borderRadius: 6, color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16 }}
          >
            &#10005;
          </button>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", backgroundColor: "var(--surface-2)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Total</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{formatCurrency(invoice.total)}</div>
          </div>
          <div style={{ padding: "12px 16px", backgroundColor: "var(--surface-2)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Paid</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--positive)" }}>{formatCurrency(invoice.amountPaid)}</div>
          </div>
          <div style={{ padding: "12px 16px", backgroundColor: "var(--surface-2)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Outstanding</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", color: invoice.status === "overdue" ? "var(--negative)" : "var(--text-primary)" }}>{formatCurrency(invoice.amountDue)}</div>
          </div>
        </div>

        {/* Actions */}
        {!isTerminal && (
          <div className="flex" style={{ gap: 8, marginBottom: 20 }}>
            {isDraft && (
              <>
                <button className="btn-secondary" onClick={onEdit} disabled={isPending}>Edit</button>
                <button className="btn-secondary" onClick={() => onSend(false)} disabled={isPending}>
                  {isPending ? "Approving..." : "Approve"}
                </button>
                {invoice.customerEmail && (
                  <button className="btn-primary" onClick={() => onSend(true)} disabled={isPending}>
                    {isPending ? "Sending..." : "Approve & email"}
                  </button>
                )}
              </>
            )}
            {canPay && (
              <button className="btn-primary" onClick={onRecordPayment} disabled={isPending}>Record payment</button>
            )}
            {isApproved && invoice.customerEmail && (
              <button className="btn-secondary" onClick={onEmailInvoice} disabled={isPending}>
                {isPending ? "Sending..." : "Send email"}
              </button>
            )}
          </div>
        )}

        {/* PDF actions */}
        {!isDraft && (
          <div className="flex" style={{ gap: 8, marginBottom: 20 }}>
            <button className="btn-secondary" onClick={onDownloadPDF} disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
            <button className="btn-secondary" onClick={onPreviewPDF} disabled={isPending} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>
          </div>
        )}

        {/* Dates */}
        <div className="flex" style={{ gap: 24, marginBottom: 20, fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Issued: </span>
            <span style={{ color: "var(--text-secondary)" }}>{formatDate(invoice.issueDate)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Due: </span>
            <span style={{ color: "var(--text-secondary)" }}>{formatDate(invoice.dueDate)}</span>
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>Line Items</h3>
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--surface-2)" }}>
                  <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "center" }}>Qty</th>
                  <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "right" }}>Price</th>
                  <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li) => (
                  <tr key={li.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{li.description}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "center", fontFamily: "var(--font-mono)" }}>{li.quantity}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontFamily: "var(--font-mono)" }}>{formatCurrency(li.unitPrice)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontFamily: "var(--font-mono)" }}>{formatCurrency(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment history */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 8 }}>Payment History</h3>
          {invoice.payments.length === 0 ? (
            <div style={{ padding: "16px 12px", fontSize: 13, color: "var(--text-disabled)", border: "1px solid var(--border)", borderRadius: 6, textAlign: "center" }}>
              No payments recorded
            </div>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--surface-2)" }}>
                    <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "left" }}>Date</th>
                    <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "left" }}>Method</th>
                    <th style={{ padding: "6px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", textAlign: "left" }}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>{formatDate(p.paymentDate)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--positive)" }}>{formatCurrency(p.amount)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-secondary)" }}>{p.paymentMethod ?? "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{p.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Spacer pushes danger action to bottom */}
        <div style={{ flex: 1 }} />

        {/* Delete — bottom of drawer, draft only */}
        {isDraft && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            {confirmDelete ? (
              <div className="flex items-center" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Delete this invoice?</span>
                <button
                  onClick={() => { setConfirmDelete(false); onDelete(); }}
                  disabled={isPending}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                    backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--negative)",
                    cursor: "pointer",
                  }}
                >
                  Yes, delete
                </button>
                <button className="btn-secondary" onClick={() => setConfirmDelete(false)} style={{ height: 32 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: 13, color: "var(--negative)", cursor: "pointer",
                }}
              >
                Delete invoice
              </button>
            )}
          </div>
        )}

        {/* Void — bottom of drawer, for approved/sent/overdue invoices */}
        {canVoid && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            {confirmVoid ? (
              <div className="flex items-center" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Void this invoice?</span>
                <button
                  onClick={() => { setConfirmVoid(false); onVoid(); }}
                  disabled={isPending}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                    backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--negative)",
                    cursor: "pointer",
                  }}
                >
                  Yes, void
                </button>
                <button className="btn-secondary" onClick={() => setConfirmVoid(false)} style={{ height: 32 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmVoid(true)}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: 13, color: "var(--negative)", cursor: "pointer",
                }}
              >
                Void invoice
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
