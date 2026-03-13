"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { usePostTransaction } from "./post-transaction-provider";
import { fetchAccounts, postTransaction } from "@/lib/actions";
import { useRouter } from "next/navigation";
import type { AccountWithBalance } from "@ledge/sdk";

/* ── Types ──────────────────────────────────────────────────────────── */

type Direction = "debit" | "credit";

interface LineItemState {
  id: string;
  accountCode: string;
  amount: string;        // kept as string for input control, parsed on submit
  direction: Direction;
}

interface AccountOption {
  code: string;
  name: string;
  type: string;
}

const ACCOUNT_TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

/* ── Template definitions ───────────────────────────────────────────── */

interface QuickTemplate {
  label: string;
  lines: { typeMatch: string; direction: Direction }[];
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: "Revenue received",
    lines: [
      { typeMatch: "asset", direction: "debit" },
      { typeMatch: "revenue", direction: "credit" },
    ],
  },
  {
    label: "Expense paid",
    lines: [
      { typeMatch: "expense", direction: "debit" },
      { typeMatch: "asset", direction: "credit" },
    ],
  },
  {
    label: "Invoice sent",
    lines: [
      { typeMatch: "asset", direction: "debit" },   // AR
      { typeMatch: "revenue", direction: "credit" },
    ],
  },
  {
    label: "Bill received",
    lines: [
      { typeMatch: "expense", direction: "debit" },
      { typeMatch: "liability", direction: "credit" },  // AP
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */

let nextLineId = 1;
function makeLineId(): string {
  return `line_${nextLineId++}`;
}

function emptyLine(): LineItemState {
  return { id: makeLineId(), accountCode: "", amount: "", direction: "debit" };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dollarsToCents(dollars: string): number {
  return Math.round(parseFloat(dollars) * 100);
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/* ── Component ──────────────────────────────────────────────────────── */

export function PostTransactionModal() {
  const { isOpen, close } = usePostTransaction();
  const router = useRouter();

  // Form state
  const [date, setDate] = useState(todayISO);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<LineItemState[]>([emptyLine(), emptyLine()]);

  // Accounts
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Submit
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dropdown search
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Load accounts when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setAccountsLoading(true);
    fetchAccounts()
      .then((accts) => {
        setAccounts(
          accts.map((a: AccountWithBalance) => ({
            code: a.code,
            name: a.name,
            type: a.type,
          })),
        );
      })
      .catch(() => setAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDate(todayISO());
      setMemo("");
      setLines([emptyLine(), emptyLine()]);
      setError(null);
      setSuccessMsg(null);
      setOpenDropdownId(null);
      setDropdownSearch("");
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
        setDropdownSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openDropdownId]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  /* ── Line item helpers ─────────────────────────────────────────────── */

  const updateLine = useCallback((id: string, patch: Partial<LineItemState>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.id !== id)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  /* ── Quick templates ───────────────────────────────────────────────── */

  const applyTemplate = useCallback(
    (template: QuickTemplate) => {
      const newLines = template.lines.map((tpl) => {
        // Find best account match for type
        const match = accounts.find((a) => a.type === tpl.typeMatch);
        return {
          id: makeLineId(),
          accountCode: match?.code ?? "",
          amount: "",
          direction: tpl.direction,
        };
      });
      setLines(newLines);
      setMemo("");
    },
    [accounts],
  );

  /* ── Validation ────────────────────────────────────────────────────── */

  const totalDebits = lines.reduce((sum, l) => {
    if (l.direction === "debit" && l.amount && !isNaN(parseFloat(l.amount))) {
      return sum + dollarsToCents(l.amount);
    }
    return sum;
  }, 0);

  const totalCredits = lines.reduce((sum, l) => {
    if (l.direction === "credit" && l.amount && !isNaN(parseFloat(l.amount))) {
      return sum + dollarsToCents(l.amount);
    }
    return sum;
  }, 0);

  const isBalanced = totalDebits === totalCredits && totalDebits > 0;
  const difference = Math.abs(totalDebits - totalCredits);

  const allLinesFilled = lines.every(
    (l) => l.accountCode && l.amount && parseFloat(l.amount) > 0,
  );

  const isValid = memo.trim().length > 0 && lines.length >= 2 && allLinesFilled && isBalanced;

  /* ── Submit ────────────────────────────────────────────────────────── */

  const handleSubmit = () => {
    if (!isValid) return;
    setError(null);

    startTransition(async () => {
      try {
        await postTransaction({
          date,
          memo: memo.trim(),
          lines: lines.map((l) => ({
            accountCode: l.accountCode,
            amount: dollarsToCents(l.amount),
            direction: l.direction,
          })),
        });
        setSuccessMsg("Transaction posted successfully");
        setTimeout(() => {
          close();
          router.refresh();
        }, 800);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to post transaction";
        setError(msg);
      }
    });
  };

  /* ── Account grouping for dropdown ─────────────────────────────────── */

  const filteredAccounts = dropdownSearch
    ? accounts.filter(
        (a) =>
          a.code.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
          a.name.toLowerCase().includes(dropdownSearch.toLowerCase()),
      )
    : accounts;

  const groupedAccounts = ACCOUNT_TYPE_ORDER.reduce<Record<string, AccountOption[]>>(
    (groups, type) => {
      const items = filteredAccounts.filter((a) => a.type === type);
      if (items.length > 0) groups[type] = items;
      return groups;
    },
    {},
  );

  /* ── Render ────────────────────────────────────────────────────────── */

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          animation: "modal-fade-in 150ms ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1001,
          pointerEvents: "none",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 560,
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
            backgroundColor: "#FFFFFF",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.12)",
            padding: 24,
            animation: "modal-slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A" }}>Post Transaction</h2>
            <button
              onClick={close}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                border: "none",
                backgroundColor: "transparent",
                color: "#999999",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F5F5F5"; e.currentTarget.style.color = "#0A0A0A"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#999999"; }}
            >
              ✕
            </button>
          </div>

          {/* Date + Description */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999999", fontWeight: 500, marginBottom: 6 }}>
                Date
              </label>
              <input
                type="date"
                className="input font-mono"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999999", fontWeight: 500, marginBottom: 6 }}>
                Description
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Monthly hosting payment"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          {/* Quick templates */}
          {accounts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999999", fontWeight: 500, marginBottom: 8 }}>
                Quick Entry
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {QUICK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    style={{
                      padding: "4px 12px",
                      height: 28,
                      borderRadius: 6,
                      border: "1px solid #E5E5E5",
                      backgroundColor: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#666666",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(0,102,255,0.3)";
                      e.currentTarget.style.backgroundColor = "#F0F6FF";
                      e.currentTarget.style.color = "#0066FF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E5E5E5";
                      e.currentTarget.style.backgroundColor = "#FFFFFF";
                      e.currentTarget.style.color = "#666666";
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line items header */}
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#999999", fontWeight: 500, marginBottom: 8 }}>
            Line Items
          </div>

          {/* Line items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {lines.map((line) => (
              <div key={line.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Account dropdown */}
                <div style={{ flex: 1, position: "relative" }} ref={openDropdownId === line.id ? dropdownRef : undefined}>
                  <button
                    onClick={() => {
                      setOpenDropdownId(openDropdownId === line.id ? null : line.id);
                      setDropdownSearch("");
                    }}
                    style={{
                      width: "100%",
                      height: 36,
                      padding: "0 12px",
                      borderRadius: 8,
                      border: "1px solid #E5E5E5",
                      backgroundColor: "#FFFFFF",
                      fontSize: 13,
                      color: line.accountCode ? "#0A0A0A" : "#999999",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {line.accountCode ? (
                      <>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#999999" }}>
                          {line.accountCode}
                        </span>
                        <span>{accounts.find((a) => a.code === line.accountCode)?.name ?? ""}</span>
                      </>
                    ) : (
                      "Select account..."
                    )}
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      style={{ marginLeft: "auto", flexShrink: 0 }}
                    >
                      <path d="M3 5l3 3 3-3" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {openDropdownId === line.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        width: "100%",
                        minWidth: 280,
                        maxHeight: 240,
                        overflowY: "auto",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E5E5",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        zIndex: 1010,
                        padding: 4,
                      }}
                    >
                      {/* Search input */}
                      <div style={{ padding: "4px 4px 8px" }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="Search accounts..."
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          autoFocus
                          style={{ height: 32, fontSize: 12 }}
                        />
                      </div>
                      {accountsLoading ? (
                        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#999999" }}>Loading...</div>
                      ) : (
                        Object.entries(groupedAccounts).map(([type, items]) => (
                          <div key={type}>
                            <div style={{
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "#999999",
                              fontWeight: 500,
                              padding: "8px 8px 4px",
                            }}>
                              {ACCOUNT_TYPE_LABELS[type] ?? type}
                            </div>
                            {items.map((acct) => (
                              <button
                                key={acct.code}
                                onClick={() => {
                                  updateLine(line.id, { accountCode: acct.code });
                                  setOpenDropdownId(null);
                                  setDropdownSearch("");
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: line.accountCode === acct.code ? "#F0F6FF" : "transparent",
                                  fontSize: 13,
                                  color: "#0A0A0A",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onMouseEnter={(e) => {
                                  if (line.accountCode !== acct.code) e.currentTarget.style.backgroundColor = "#F5F5F5";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = line.accountCode === acct.code ? "#F0F6FF" : "transparent";
                                }}
                              >
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#999999", minWidth: 40 }}>
                                  {acct.code}
                                </span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {acct.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                      {!accountsLoading && filteredAccounts.length === 0 && (
                        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#999999" }}>No accounts found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div style={{ width: 100 }}>
                  <input
                    type="number"
                    className="input font-mono"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                    min="0"
                    step="0.01"
                    style={{ fontSize: 13, textAlign: "right" }}
                  />
                </div>

                {/* Direction toggle */}
                <div style={{ display: "flex", borderRadius: 6, border: "1px solid #E5E5E5", overflow: "hidden", flexShrink: 0 }}>
                  <button
                    onClick={() => updateLine(line.id, { direction: "debit" })}
                    style={{
                      padding: "0 10px",
                      height: 36,
                      border: "none",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      backgroundColor: line.direction === "debit" ? "#0066FF" : "#FFFFFF",
                      color: line.direction === "debit" ? "#FFFFFF" : "#999999",
                      transition: "all 150ms ease",
                    }}
                  >
                    DR
                  </button>
                  <button
                    onClick={() => updateLine(line.id, { direction: "credit" })}
                    style={{
                      padding: "0 10px",
                      height: 36,
                      border: "none",
                      borderLeft: "1px solid #E5E5E5",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      backgroundColor: line.direction === "credit" ? "#0066FF" : "#FFFFFF",
                      color: line.direction === "credit" ? "#FFFFFF" : "#999999",
                      transition: "all 150ms ease",
                    }}
                  >
                    CR
                  </button>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length <= 2}
                  style={{
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "transparent",
                    color: lines.length <= 2 ? "#E5E5E5" : "#999999",
                    cursor: lines.length <= 2 ? "default" : "pointer",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (lines.length > 2) { e.currentTarget.style.backgroundColor = "#FEF2F2"; e.currentTarget.style.color = "#DC2626"; }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = lines.length <= 2 ? "#E5E5E5" : "#999999";
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add line button */}
          <button
            onClick={addLine}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              height: 32,
              borderRadius: 6,
              border: "1px dashed #E5E5E5",
              backgroundColor: "transparent",
              fontSize: 12,
              fontWeight: 500,
              color: "#999999",
              cursor: "pointer",
              marginBottom: 16,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0066FF";
              e.currentTarget.style.color = "#0066FF";
              e.currentTarget.style.backgroundColor = "#F0F6FF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E5E5";
              e.currentTarget.style.color = "#999999";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 2v8M2 6h8" />
            </svg>
            Add line item
          </button>

          {/* Balance indicator */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#FAFAFA",
              border: "1px solid #E5E5E5",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
              <span>
                <span style={{ color: "#999999", fontWeight: 500, marginRight: 4 }}>Debits:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#0A0A0A" }}>{formatDollars(totalDebits)}</span>
              </span>
              <span>
                <span style={{ color: "#999999", fontWeight: 500, marginRight: 4 }}>Credits:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#0A0A0A" }}>{formatDollars(totalCredits)}</span>
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {totalDebits === 0 && totalCredits === 0 ? (
                <span style={{ color: "#999999" }}>—</span>
              ) : isBalanced ? (
                <span style={{ color: "#00A854" }}>Balanced ✓</span>
              ) : (
                <span style={{ color: "#DC2626" }}>Difference: {formatDollars(difference)}</span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 8,
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              fontSize: 13,
              color: "#DC2626",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Success toast */}
          {successMsg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 8,
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
              fontSize: 13,
              color: "#00A854",
              fontWeight: 500,
              marginBottom: 16,
            }}>
              {successMsg}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn-secondary" onClick={close} style={{ fontSize: 13 }}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              style={{
                fontSize: 13,
                opacity: !isValid || isPending ? 0.5 : 1,
                cursor: !isValid || isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Posting..." : "Post Transaction"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
