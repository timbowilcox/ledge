"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { fetchTransactions } from "@/lib/actions";
import type { TransactionWithLines, PaginatedResult, AccountWithBalance } from "@ledge/sdk";
import { ContextualPrompt } from "@/components/contextual-prompt";
import { usePostTransaction } from "@/components/post-transaction-provider";

interface Props {
  initialData: PaginatedResult<TransactionWithLines>;
  accountMap: Record<string, { code: string; name: string }>;
}

type StatusFilter = "all" | "posted" | "reversed";

export function TransactionsView({ initialData, accountMap }: Props) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cursors, setCursors] = useState<string[]>([]);
  const { open: openPostTransaction } = usePostTransaction();

  const filtered = data.data.filter((tx) => {
    if (filter !== "all" && tx.status !== filter) return false;
    if (search && !tx.memo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const loadNext = () => {
    if (!data.nextCursor) return;
    startTransition(async () => {
      const result = await fetchTransactions(data.nextCursor ?? undefined, 50);
      setCursors([...cursors, ""]);
      setData(result);
    });
  };

  const txAmount = (tx: TransactionWithLines) =>
    tx.lines.filter((l) => l.direction === "debit").reduce((sum, l) => sum + l.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0A0A0A" }}>
          Transactions
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ContextualPrompt placeholder="Search or ask about transactions..." />
          <button className="btn-primary" onClick={openPostTransaction} style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Post transaction
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex" style={{ gap: 4 }}>
          {(["all", "posted", "reversed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="capitalize"
              style={{
                padding: "0 12px",
                height: 32,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: filter === s ? "#F0F6FF" : "transparent",
                color: filter === s ? "#0066FF" : "#999999",
                border: filter === s ? "1px solid rgba(0,102,255,0.2)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header" style={{ width: 120, position: "sticky", top: 0, zIndex: 1 }}>Date</th>
              <th className="table-header" style={{ position: "sticky", top: 0, zIndex: 1 }}>Description</th>
              <th className="table-header text-right" style={{ width: 140, position: "sticky", top: 0, zIndex: 1 }}>Amount</th>
              <th className="table-header text-right" style={{ width: 100, position: "sticky", top: 0, zIndex: 1 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                amount={txAmount(tx)}
                accountMap={accountMap}
                isExpanded={expandedId === tx.id}
                onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="table-cell text-center" style={{ padding: 48 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 320, margin: "0 auto" }}>
                    <div style={{ marginBottom: 8 }}>
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#D4D4D4" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M8 14h32M8 24h32M8 34h20" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#0A0A0A" }}>No transactions found</div>
                    <div style={{ fontSize: 13, color: "#999999", marginBottom: 4 }}>
                      {search || filter !== "all" ? "Try adjusting your search or filters." : "Post your first transaction to see it here."}
                    </div>
                    {!search && filter === "all" && (
                      <button
                        className="btn-primary"
                        onClick={openPostTransaction}
                        style={{ marginTop: 8 }}
                      >
                        Post transaction
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.nextCursor && (
        <div className="flex justify-end" style={{ marginTop: 16 }}>
          <button
            className="btn-secondary"
            style={{ fontSize: 12 }}
            onClick={loadNext}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  amount,
  accountMap,
  isExpanded,
  onToggle,
}: {
  tx: TransactionWithLines;
  amount: number;
  accountMap: Record<string, { code: string; name: string }>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="table-row cursor-pointer" onClick={onToggle}>
        <td className="table-cell font-mono" style={{ fontSize: 13, color: "#666666" }}>{formatDate(tx.date)}</td>
        <td className="table-cell" style={{ fontSize: 13, color: "#0A0A0A", fontWeight: 500 }}>{tx.memo}</td>
        <td className="table-cell text-right font-mono" style={{ fontSize: 13, color: amount < 0 ? "#DC2626" : undefined }}>
          {formatCurrency(amount)}
        </td>
        <td className="table-cell text-right">
          <span className={"badge " + (tx.status === "posted" ? "badge-green" : "badge-red")}>
            {tx.status}
          </span>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={4} style={{ padding: 0 }}>
            <div
              style={{
                margin: "0 16px 12px",
                borderRadius: 8,
                backgroundColor: "#FAFAFA",
                border: "1px solid #E5E5E5",
              }}
            >
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header" style={{ fontSize: 12, paddingTop: 12, paddingBottom: 12 }}>Account</th>
                    <th className="table-header text-right" style={{ fontSize: 12, paddingTop: 12, paddingBottom: 12, width: 120 }}>Debit</th>
                    <th className="table-header text-right" style={{ fontSize: 12, paddingTop: 12, paddingBottom: 12, width: 120 }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.lines.map((line, i) => {
                    const acct = accountMap[line.accountId];
                    return (
                      <tr key={i}>
                        <td className="table-cell" style={{ fontSize: 13, paddingTop: 8, paddingBottom: 8 }}>
                          {acct && (
                            <code className="font-mono" style={{ fontSize: 12, color: "#999999", marginRight: 8 }}>
                              {acct.code}
                            </code>
                          )}
                          <span>{acct?.name ?? line.accountId}</span>
                        </td>
                        <td className="table-cell text-right font-mono" style={{ fontSize: 13, paddingTop: 8, paddingBottom: 8 }}>
                          {line.direction === "debit" ? formatCurrency(line.amount) : ""}
                        </td>
                        <td className="table-cell text-right font-mono" style={{ fontSize: 13, paddingTop: 8, paddingBottom: 8 }}>
                          {line.direction === "credit" ? formatCurrency(line.amount) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
