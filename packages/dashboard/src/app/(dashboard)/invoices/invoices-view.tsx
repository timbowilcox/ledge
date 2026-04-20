"use client";

// ---------------------------------------------------------------------------
// Invoices — list/summary view and orchestration container.
//
// Sub-components live in their own files:
//   _shared.tsx               — helpers, shared styles, StatusBadge/StatCard
//   create-invoice-modal.tsx  — create/edit modal
//   invoice-detail-drawer.tsx — right-side detail panel
//   record-payment-modal.tsx  — payment recording modal
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  fetchInvoices,
  fetchInvoiceSummary,
  fetchInvoice,
  sendInvoiceAction,
  emailInvoiceAction,
  voidInvoiceAction,
  deleteInvoiceAction,
} from "@/lib/actions";
import type {
  InvoiceListItem,
  InvoiceSummary,
  ARAgingBucket,
  CustomerListItem,
} from "@/lib/actions";
import type { AccountWithBalance } from "@kounta/sdk";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { StatusBadge, StatCard } from "./_shared";
import { CreateInvoiceModal } from "./create-invoice-modal";
import { InvoiceDetailDrawer } from "./invoice-detail-drawer";
import { RecordPaymentModal } from "./record-payment-modal";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  initialInvoices: InvoiceListItem[];
  initialSummary: InvoiceSummary;
  initialAging: ARAgingBucket[];
  accounts: AccountWithBalance[];
  customers: CustomerListItem[];
  taxLabel: string;
  taxRate: number;
  currentTier?: string;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type StatusTab = "all" | "draft" | "approved" | "sent" | "overdue" | "partially_paid" | "paid" | "void";
const TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "partially_paid", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function InvoicesView({ initialInvoices, initialSummary, accounts, customers, taxLabel, taxRate, currentTier = "free" }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [summary, setSummary] = useState(initialSummary);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<InvoiceListItem | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceListItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const [tierError, setTierError] = useState<string | null>(null);
  const [showPdfUpgrade, setShowPdfUpgrade] = useState(false);
  const [showEmailUpgrade, setShowEmailUpgrade] = useState(false);
  const [previewPDF, setPreviewPDF] = useState<string | null>(null);
  const canPdf = currentTier !== "free";
  const canEmail = currentTier !== "free";

  const refresh = () => {
    startTransition(async () => {
      try {
        const [inv, sum] = await Promise.all([
          fetchInvoices(activeTab === "all" ? undefined : activeTab),
          fetchInvoiceSummary(),
        ]);
        setInvoices(inv);
        setSummary(sum);
      } catch {
        // API error — keep current data
      }
    });
  };

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab);
    startTransition(async () => {
      try {
        const inv = await fetchInvoices(tab === "all" ? undefined : tab);
        setInvoices(inv);
      } catch {
        // API error — keep current tab
      }
    });
  };

  const handleRowClick = (inv: InvoiceListItem) => {
    startTransition(async () => {
      try {
        const detail = await fetchInvoice(inv.id);
        if (detail) setDetailInvoice(detail);
      } catch (e) {
        console.error("[invoices] row click failed:", e);
      }
    });
  };

  const handleSend = (id: string, sendEmail: boolean = false) => {
    startTransition(async () => {
      try {
        const actionResult = await sendInvoiceAction(id, sendEmail);
        if (!actionResult.ok) {
          setTierError(actionResult.error.type === "tier_limit"
            ? `${actionResult.error.message}. Upgrade your plan to continue.`
            : actionResult.error.message);
          return;
        }
        if (actionResult.data) {
          setDetailInvoice(actionResult.data);
          refresh();
        }
      } catch (e) {
        console.error("[invoices] send failed:", e);
      }
    });
  };

  const handleEmailInvoice = (id: string) => {
    if (!canEmail) { setShowEmailUpgrade(true); return; }
    startTransition(async () => {
      try {
        const actionResult = await emailInvoiceAction(id);
        if (!actionResult.ok) {
          setTierError(actionResult.error.type === "tier_limit"
            ? `${actionResult.error.message}. Upgrade your plan to continue.`
            : actionResult.error.message);
          return;
        }
        if (actionResult.data) {
          setDetailInvoice(actionResult.data);
          refresh();
        }
      } catch (e) {
        console.error("[invoices] email failed:", e);
      }
    });
  };

  const handleVoid = (id: string) => {
    startTransition(async () => {
      try {
        const result = await voidInvoiceAction(id);
        if (result) {
          setDetailInvoice(result);
          refresh();
        }
      } catch (e) {
        console.error("[invoices] void failed:", e);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const ok = await deleteInvoiceAction(id);
        if (ok) {
          setDetailInvoice(null);
          refresh();
        }
      } catch (e) {
        console.error("[invoices] delete failed:", e);
      }
    });
  };

  const handleDownloadPDF = (id: string) => {
    if (!canPdf) { setShowPdfUpgrade(true); return; }
    window.open(`/api/invoices/${id}/pdf`, "_blank");
  };

  const handlePreviewPDF = (id: string) => {
    if (!canPdf) { setShowPdfUpgrade(true); return; }
    setPreviewPDF(`/api/invoices/${id}/pdf`);
  };

  const filtered = invoices;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Invoices</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            Accounts receivable — create, send, and track payments
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          New invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4" style={{ gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary.totalOutstanding)}
          sub={`${summary.invoiceCount} invoice${summary.invoiceCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(summary.totalOverdue)}
          sub={`${summary.overdueCount} overdue`}
          warn={summary.overdueCount > 0}
        />
        <StatCard
          label="Draft"
          value={formatCurrency(summary.totalDraft)}
        />
        <StatCard
          label="Paid this month"
          value={formatCurrency(summary.totalPaidThisMonth)}
          sub={summary.averageDaysToPayment != null ? `Avg ${Math.round(summary.averageDaysToPayment)} days to pay` : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex" style={{ gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 500 : 400,
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
              backgroundColor: "transparent",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: activeTab === tab.key ? "var(--accent)" : "transparent",
              cursor: "pointer",
              transition: "color 150ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>No invoices</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Create your first invoice to start tracking accounts receivable.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Invoice #", "Customer", "Issue Date", "Due Date", "Total", "Amount Due", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-tertiary)",
                      textAlign: h === "Total" || h === "Amount Due" ? "right" : "left",
                      position: "sticky",
                      top: 0,
                      backgroundColor: "var(--surface-1)",
                      zIndex: 1,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => handleRowClick(inv)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background-color 150ms" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                    {inv.invoiceNumber}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-primary)" }}>{inv.customerName}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(inv.issueDate)}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(inv.dueDate)}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--text-primary)" }}>
                    {formatCurrency(inv.total)}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "right", color: inv.amountDue > 0 && inv.status === "overdue" ? "var(--negative)" : "var(--text-primary)" }}>
                    {formatCurrency(inv.amountDue)}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td style={{ padding: "10px 8px", width: 36 }}>
                    {inv.status !== "draft" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadPDF(inv.id); }}
                        title="Download PDF"
                        style={{
                          width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                          backgroundColor: "transparent", border: "none", borderRadius: 4,
                          color: "var(--text-tertiary)", cursor: "pointer",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <polyline points="9 15 12 18 15 15" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      {(showCreate || editInvoice) && (
        <CreateInvoiceModal
          editInvoice={editInvoice}
          taxLabel={taxLabel}
          taxRate={taxRate}
          accounts={accounts}
          customers={customers}
          onClose={() => { setShowCreate(false); setEditInvoice(null); }}
          onCreated={(inv) => {
            setShowCreate(false);
            setEditInvoice(null);
            refresh();
            if (inv) setDetailInvoice(inv);
          }}
        />
      )}

      {/* Detail drawer */}
      {detailInvoice && (
        <InvoiceDetailDrawer
          invoice={detailInvoice}
          isPending={isPending}
          onClose={() => setDetailInvoice(null)}
          onSend={(sendEmail: boolean) => handleSend(detailInvoice.id, sendEmail)}
          onEmailInvoice={() => handleEmailInvoice(detailInvoice.id)}
          onVoid={() => handleVoid(detailInvoice.id)}
          onDelete={() => handleDelete(detailInvoice.id)}
          onEdit={() => { setEditInvoice(detailInvoice); setDetailInvoice(null); }}
          onRecordPayment={() => setShowPayment(true)}
          onDownloadPDF={() => handleDownloadPDF(detailInvoice.id)}
          onPreviewPDF={() => handlePreviewPDF(detailInvoice.id)}
        />
      )}

      {/* Record payment modal */}
      {showPayment && detailInvoice && (
        <RecordPaymentModal
          invoice={detailInvoice}
          onClose={() => setShowPayment(false)}
          onRecorded={(updated) => {
            setShowPayment(false);
            if (updated) setDetailInvoice(updated);
            refresh();
          }}
        />
      )}

      {/* Tier error banner */}
      {tierError && (
        <div style={{ padding: "12px 16px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#ef4444" }}>{tierError}</span>
          <button onClick={() => setTierError(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>&times;</button>
        </div>
      )}

      {/* PDF upgrade prompt */}
      {showPdfUpgrade && (
        <>
          <div onClick={() => setShowPdfUpgrade(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, width: 440 }}>
            <UpgradePrompt feature="pdfExport" message="PDF invoice export is available on Builder ($19/month). Upgrade to download and preview invoice PDFs." currentTier={currentTier} requiredTier="builder" />
            <button onClick={() => setShowPdfUpgrade(false)} style={{ marginTop: 12, width: "100%", padding: "8px 0", fontSize: 13, color: "var(--text-tertiary)", backgroundColor: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
              Maybe later
            </button>
          </div>
        </>
      )}

      {/* Email upgrade prompt */}
      {showEmailUpgrade && (
        <>
          <div onClick={() => setShowEmailUpgrade(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 200 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 201, width: 440 }}>
            <UpgradePrompt feature="invoiceEmail" message="Invoice email requires Builder plan. Upgrade to send invoices directly to your customers." currentTier={currentTier} requiredTier="builder" />
            <button onClick={() => setShowEmailUpgrade(false)} style={{ marginTop: 12, width: "100%", padding: "8px 0", fontSize: 13, color: "var(--text-tertiary)", backgroundColor: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
              Maybe later
            </button>
          </div>
        </>
      )}

      {/* PDF preview modal */}
      {previewPDF && (
        <>
          <div
            onClick={() => setPreviewPDF(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 200 }}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: "80vw", height: "85vh",
              backgroundColor: "var(--surface-1)", borderRadius: 8,
              border: "1px solid var(--border)", zIndex: 201,
              display: "flex", flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Invoice Preview</span>
              <button
                onClick={() => setPreviewPDF(null)}
                style={{
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: "transparent", border: "none", borderRadius: 6,
                  color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16,
                }}
              >
                &#10005;
              </button>
            </div>
            <iframe
              src={previewPDF}
              style={{ flex: 1, border: "none", borderRadius: "0 0 8px 8px" }}
              title="Invoice PDF Preview"
            />
          </div>
        </>
      )}
    </div>
  );
}
