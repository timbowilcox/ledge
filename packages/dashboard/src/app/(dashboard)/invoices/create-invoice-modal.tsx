"use client";

// ---------------------------------------------------------------------------
// Create / Edit Invoice Modal — handles both creation and editing flows.
// Extracted from invoices-view.tsx.
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import {
  createInvoiceAction,
  updateInvoiceAction,
  sendInvoiceAction,
} from "@/lib/actions";
import type { InvoiceListItem, CustomerListItem } from "@/lib/actions";
import type { AccountWithBalance } from "@kounta/sdk";
import {
  todayISO,
  plus30,
  dollarsToCents,
  centsToDollars,
  labelStyle,
  inputStyle,
  PAYMENT_TERMS_OPTIONS,
} from "./_shared";

export function CreateInvoiceModal({
  editInvoice,
  taxLabel,
  taxRate,
  accounts,
  customers,
  onClose,
  onCreated,
}: {
  editInvoice: InvoiceListItem | null;
  taxLabel: string;
  taxRate: number;
  accounts: AccountWithBalance[];
  customers: CustomerListItem[];
  onClose: () => void;
  onCreated: (inv: InvoiceListItem | null) => void;
}) {
  const isEdit = !!editInvoice;

  const [invoiceNumber, setInvoiceNumber] = useState(editInvoice?.invoiceNumber ?? "");
  const [customerId, setCustomerId] = useState<string>(editInvoice?.customerId ?? "");
  const [customerName, setCustomerName] = useState(editInvoice?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(editInvoice?.customerEmail ?? "");
  const [paymentTerms, setPaymentTerms] = useState(editInvoice?.paymentTerms ?? "net_30");
  const [issueDate, setIssueDate] = useState(editInvoice?.issueDate?.slice(0, 10) ?? todayISO());
  const [dueDate, setDueDate] = useState(editInvoice?.dueDate?.slice(0, 10) ?? plus30());
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase())),
  );

  const selectCustomer = (c: CustomerListItem) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerEmail(c.email ?? "");
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    if (c.paymentTerms) {
      setPaymentTerms(c.paymentTerms);
      const termsDays: Record<string, number> = {
        due_on_receipt: 0, net_7: 7, net_14: 14, net_15: 15,
        net_30: 30, net_45: 45, net_60: 60, net_90: 90,
      };
      const days = termsDays[c.paymentTerms] ?? 30;
      const d = new Date(issueDate);
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().slice(0, 10));
    }
  };
  const [notes, setNotes] = useState("");
  const [showNotesOnInvoice, setShowNotesOnInvoice] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue" || (a.code && a.code.startsWith("4")));

  interface LineItemForm {
    description: string;
    quantity: string;
    unitPriceDollars: string;
    accountId: string;
  }

  const defaultLines: LineItemForm[] = editInvoice && editInvoice.lineItems.length > 0
    ? editInvoice.lineItems.map((li) => ({
        description: li.description,
        quantity: String(li.quantity),
        unitPriceDollars: centsToDollars(li.unitPrice),
        accountId: "",
      }))
    : [{ description: "", quantity: "1", unitPriceDollars: "", accountId: "" }];

  const [lineItems, setLineItems] = useState<LineItemForm[]>(defaultLines);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addLine = () => setLineItems([...lineItems, { description: "", quantity: "1", unitPriceDollars: "", accountId: "" }]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItemForm, value: string) => {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.quantity) || 0;
    const price = dollarsToCents(li.unitPriceDollars);
    return sum + Math.round(qty * price);
  }, 0);

  const hasTax = taxRate > 0;
  const taxAmount = hasTax
    ? taxInclusive
      ? Math.round(subtotal - subtotal / (1 + taxRate))
      : Math.round(subtotal * taxRate)
    : 0;
  const total = hasTax
    ? taxInclusive
      ? subtotal
      : subtotal + taxAmount
    : subtotal;

  const isValid = customerName.trim().length > 0 && lineItems.length > 0 &&
    lineItems.every((li) => li.description.trim() && parseFloat(li.quantity) > 0 && parseFloat(li.unitPriceDollars) > 0);

  const handleSubmit = (mode: "draft" | "approve" | "approve-email") => {
    setError(null);
    startTransition(async () => {
      try {
        const input = {
          customerId: customerId || undefined,
          customerName,
          customerEmail: customerEmail || undefined,
          paymentTerms: paymentTerms || undefined,
          issueDate,
          dueDate,
          invoiceNumber: invoiceNumber || undefined,
          lineItems: lineItems.map((li) => ({
            description: li.description,
            quantity: parseFloat(li.quantity) || 1,
            unitPrice: dollarsToCents(li.unitPriceDollars),
            taxRate: hasTax ? taxRate : undefined,
            accountId: li.accountId || undefined,
          })),
          notes: notes || undefined,
          taxInclusive,
        };

        let result: InvoiceListItem | null;
        if (isEdit && editInvoice) {
          result = await updateInvoiceAction(editInvoice.id, input);
        } else {
          const actionResult = await createInvoiceAction(input);
          if (!actionResult.ok) {
            const tierErr = actionResult.error;
            if (tierErr.type === "tier_limit") {
              setError(`${tierErr.message}. Upgrade your plan to continue.`);
            } else {
              setError(tierErr.message);
            }
            return;
          }
          result = actionResult.data;
        }

        if (!result) {
          setError("Failed to save invoice. Please check your inputs.");
          return;
        }

        if (mode === "approve" || mode === "approve-email") {
          const sendResult = await sendInvoiceAction(result.id, mode === "approve-email");
          onCreated(sendResult.ok && sendResult.data ? sendResult.data : result);
        } else {
          onCreated(result);
        }
      } catch (e) {
        console.error("[create-invoice] failed:", e);
        setError("Something went wrong. Please try again.");
      }
    });
  };

  // Keep a reference to showNotesOnInvoice in JSX below to satisfy the linter.
  void showNotesOnInvoice;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)", zIndex: 100,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 720, maxHeight: "85vh", overflowY: "auto",
          backgroundColor: "var(--surface-1)", borderRadius: 8,
          border: "1px solid var(--border)", zIndex: 101,
          padding: 24,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{isEdit ? "Edit Invoice" : "New Invoice"}</h2>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "transparent", border: "none", borderRadius: 6,
              color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16,
            }}
          >
            &#10005;
          </button>
        </div>

        {/* Invoice number */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Invoice number</label>
          <input
            style={{ ...inputStyle, width: 200, fontFamily: "var(--font-mono)" }}
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Auto-generated"
          />
        </div>

        {/* Customer — autocomplete from saved customers */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <label style={labelStyle}>Customer *</label>
              <input
                style={inputStyle}
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerSearch(e.target.value);
                  setCustomerId("");
                  setShowCustomerDropdown(e.target.value.length > 0 && customers.length > 0);
                }}
                onFocus={() => {
                  if (customerName.length > 0 && customers.length > 0 && !customerId) {
                    setCustomerSearch(customerName);
                    setShowCustomerDropdown(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                placeholder="Search or type customer name..."
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
                  backgroundColor: "#ffffff", border: "1px solid var(--border)", borderRadius: 6,
                  maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}>
                  {filteredCustomers.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: 13,
                        color: "#1a1a1a", borderBottom: "1px solid #eee",
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 11, color: "#888" }}>{c.email}</div>}
                    </div>
                  ))}
                </div>
              )}
              {customerId && (
                <div style={{ fontSize: 11, color: "var(--positive)", marginTop: 2 }}>
                  Linked to saved customer
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Customer email</label>
              <input style={inputStyle} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="billing@acme.com" />
            </div>
          </div>
        </div>

        {/* Dates + Payment terms */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Issue date</label>
            <input type="date" style={inputStyle} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Payment terms</label>
            <select
              style={{ ...inputStyle, color: "var(--text-primary)" }}
              value={paymentTerms}
              onChange={(e) => {
                setPaymentTerms(e.target.value);
                const termsDays: Record<string, number> = {
                  due_on_receipt: 0, net_7: 7, net_14: 14, net_15: 15,
                  net_30: 30, net_45: 45, net_60: 60, net_90: 90,
                };
                const days = termsDays[e.target.value] ?? 30;
                const d = new Date(issueDate);
                d.setDate(d.getDate() + days);
                setDueDate(d.toISOString().slice(0, 10));
              }}
            >
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t.code} value={t.code} style={{ color: "#1a1a1a", backgroundColor: "#ffffff" }}>{t.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Due date</label>
            <input type="date" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Line items</label>
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ display: "flex", backgroundColor: "var(--surface-2)", padding: "6px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
              <div style={{ flex: 3 }}>Description</div>
              <div style={{ width: 130, textAlign: "left", paddingLeft: 8 }}>Account</div>
              <div style={{ width: 60, textAlign: "center" }}>Qty</div>
              <div style={{ width: 90, textAlign: "right" }}>Unit Price</div>
              <div style={{ width: 90, textAlign: "right" }}>Amount</div>
              <div style={{ width: 28 }} />
            </div>
            {lineItems.map((li, i) => {
              const amt = Math.round((parseFloat(li.quantity) || 0) * dollarsToCents(li.unitPriceDollars));
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "4px 10px", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div style={{ flex: 3, paddingRight: 8 }}>
                    <input
                      style={{ ...inputStyle, height: 32, backgroundColor: "transparent", border: "none" }}
                      value={li.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Description"
                    />
                  </div>
                  <div style={{ width: 130, paddingLeft: 8 }}>
                    <select
                      style={{ ...inputStyle, height: 32, fontSize: 11, backgroundColor: "transparent", border: "none", padding: "0 4px", color: "var(--text-primary)" }}
                      value={li.accountId}
                      onChange={(e) => updateLine(i, "accountId", e.target.value)}
                    >
                      <option value="" style={{ color: "#1a1a1a", backgroundColor: "#ffffff" }}>Default</option>
                      {revenueAccounts.map((a) => (
                        <option key={a.id} value={a.id} style={{ color: "#1a1a1a", backgroundColor: "#ffffff" }}>{a.code ? `${a.code} ${a.name}` : a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 60, paddingRight: 8 }}>
                    <input
                      style={{ ...inputStyle, height: 32, backgroundColor: "transparent", border: "none", textAlign: "center" }}
                      value={li.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    />
                  </div>
                  <div style={{ width: 90, paddingRight: 8 }}>
                    <input
                      style={{ ...inputStyle, height: 32, backgroundColor: "transparent", border: "none", textAlign: "right", fontFamily: "var(--font-mono)" }}
                      value={li.unitPriceDollars}
                      onChange={(e) => updateLine(i, "unitPriceDollars", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div style={{ width: 90, textAlign: "right", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                    {formatCurrency(amt)}
                  </div>
                  <div style={{ width: 28, textAlign: "center" }}>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLine(i)}
                        style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 14 }}
                      >
                        &#10005;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={addLine}
            className="btn-ghost"
            style={{ marginTop: 8, fontSize: 12, height: 28, padding: "0 10px" }}
          >
            + Add line item
          </button>
        </div>

        {/* Tax option */}
        {hasTax && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} />
              Prices include {taxLabel}
            </label>
          </div>
        )}

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{ width: 240 }}>
            <div className="flex justify-between" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(subtotal)}</span>
            </div>
            {hasTax && (
              <div className="flex justify-between" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                <span>{taxInclusive ? `Includes ${taxLabel} of` : `${taxLabel} at ${Math.round(taxRate * 100)}%`}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <span>Total</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, height: 60, resize: "vertical", padding: 10 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, thank you message, etc."
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", marginTop: 8 }}>
            <input type="checkbox" checked={showNotesOnInvoice} onChange={(e) => setShowNotesOnInvoice(e.target.checked)} />
            Show notes on invoice
          </label>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 6, backgroundColor: "rgba(239,68,68,0.1)", color: "var(--negative)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end" style={{ gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {isEdit ? (
            <>
              <button className="btn-secondary" disabled={!isValid || isPending} onClick={() => handleSubmit("draft")}>
                {isPending ? "Saving..." : "Update"}
              </button>
              <button className="btn-secondary" disabled={!isValid || isPending} onClick={() => handleSubmit("approve")}>
                {isPending ? "Approving..." : "Approve"}
              </button>
              {customerEmail.trim() && (
                <button className="btn-primary" disabled={!isValid || isPending} onClick={() => handleSubmit("approve-email")}>
                  {isPending ? "Sending..." : "Approve & email"}
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn-secondary" disabled={!isValid || isPending} onClick={() => handleSubmit("draft")}>
                {isPending ? "Saving..." : "Save as draft"}
              </button>
              <button className="btn-secondary" disabled={!isValid || isPending} onClick={() => handleSubmit("approve")}>
                {isPending ? "Approving..." : "Approve"}
              </button>
              <button
                className="btn-primary"
                disabled={!isValid || isPending || !customerEmail.trim()}
                onClick={() => handleSubmit("approve-email")}
                title={!customerEmail.trim() ? "Enter customer email to send" : undefined}
                style={!customerEmail.trim() ? { opacity: 0.5 } : undefined}
              >
                {isPending ? "Sending..." : "Approve & email"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
