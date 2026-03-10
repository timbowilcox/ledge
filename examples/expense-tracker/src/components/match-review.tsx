"use client";

import { useState } from "react";
import { formatCurrency, formatDate, formatConfidence } from "@/lib/format";

interface ImportRow {
  id: string;
  date: string;
  amount: number;
  payee: string;
  memo: string | null;
  matchStatus: "matched" | "suggested" | "unmatched";
  matchedTransactionId: string | null;
  confidence: number | null;
}

interface ImportBatch {
  id: string;
  filename: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  status: string;
}

interface ImportResult {
  batch: ImportBatch;
  rows: readonly ImportRow[];
}

function confidenceColor(score: number): string {
  if (score >= 0.9) return "#22c55e";
  if (score >= 0.6) return "#f59e0b";
  return "#ef4444";
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    matched: {
      bg: "rgba(34,197,94,0.1)",
      color: "#22c55e",
      border: "rgba(34,197,94,0.2)",
    },
    suggested: {
      bg: "rgba(245,158,11,0.1)",
      color: "#f59e0b",
      border: "rgba(245,158,11,0.2)",
    },
    unmatched: {
      bg: "rgba(239,68,68,0.1)",
      color: "#ef4444",
      border: "rgba(239,68,68,0.2)",
    },
  };
  const c = colors[status] ?? colors.unmatched;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: c.bg,
        color: c.color,
        border: "1px solid " + c.border,
      }}
    >
      {status}
    </span>
  );
}

export function MatchReview({
  result,
  onConfirmed,
}: {
  result: ImportResult;
  onConfirmed: () => void;
}) {
  const [actions, setActions] = useState<Record<string, "confirm" | "reject">>(() => {
    const init: Record<string, "confirm" | "reject"> = {};
    for (const row of result.rows) {
      if (row.matchStatus === "matched" || row.matchStatus === "suggested") {
        init[row.id] = "confirm";
      } else {
        init[row.id] = "reject";
      }
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const toggleAction = (rowId: string) => {
    setActions((prev) => ({
      ...prev,
      [rowId]: prev[rowId] === "confirm" ? "reject" : "confirm",
    }));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const payload = result.rows
        .filter((r) => r.matchStatus !== "unmatched")
        .map((r) => ({
          rowId: r.id,
          action: actions[r.id] ?? "reject",
        }));

      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: result.batch.id, actions: payload }),
      });

      if (!res.ok) throw new Error("Failed to confirm matches");
      setConfirmed(true);
      onConfirmed();
    } catch (err) {
      console.error(err);
      alert("Failed to confirm matches");
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="card text-center py-8">
        <p className="text-lg font-bold text-slate-50">Matches Confirmed</p>
        <p className="text-sm mt-2" style={{ color: "#64748b" }}>
          Import batch {result.batch.id.slice(0, 8)} has been reconciled.
        </p>
      </div>
    );
  }

  const matchedRows = result.rows.filter((r) => r.matchStatus !== "unmatched");
  const unmatchedRows = result.rows.filter((r) => r.matchStatus === "unmatched");

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-50">Match Review</h2>
          <span className="text-xs" style={{ color: "#64748b" }}>
            {result.batch.matchedCount} matched, {result.batch.unmatchedCount} unmatched
            of {result.batch.rowCount} rows
          </span>
        </div>
        {matchedRows.length > 0 && (
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Confirming..." : "Confirm Matches"}
          </button>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th className="table-header">Date</th>
            <th className="table-header">Payee</th>
            <th className="table-header text-right">Amount</th>
            <th className="table-header">Status</th>
            <th className="table-header">Confidence</th>
            <th className="table-header text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {matchedRows.map((row) => (
            <tr key={row.id} className="table-row">
              <td className="table-cell text-sm font-mono" style={{ color: "#94a3b8" }}>
                {formatDate(row.date)}
              </td>
              <td className="table-cell text-sm text-slate-50">{row.payee}</td>
              <td className="table-cell text-right font-mono text-sm text-slate-50">
                {formatCurrency(row.amount)}
              </td>
              <td className="table-cell">{statusBadge(row.matchStatus)}</td>
              <td className="table-cell" style={{ minWidth: 120 }}>
                <div className="flex items-center gap-2">
                  <div className="confidence-bar flex-1">
                    <div
                      className="confidence-fill"
                      style={{
                        width: formatConfidence(row.confidence ?? 0) + "%",
                        background: confidenceColor(row.confidence ?? 0),
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono"
                    style={{ color: confidenceColor(row.confidence ?? 0) }}
                  >
                    {formatConfidence(row.confidence ?? 0)}%
                  </span>
                </div>
              </td>
              <td className="table-cell text-center">
                <button
                  className={actions[row.id] === "confirm" ? "btn-success" : "btn-danger"}
                  onClick={() => toggleAction(row.id)}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  {actions[row.id] === "confirm" ? "Keep" : "Reject"}
                </button>
              </td>
            </tr>
          ))}
          {unmatchedRows.map((row) => (
            <tr key={row.id} className="table-row" style={{ opacity: 0.6 }}>
              <td className="table-cell text-sm font-mono" style={{ color: "#94a3b8" }}>
                {formatDate(row.date)}
              </td>
              <td className="table-cell text-sm text-slate-50">{row.payee}</td>
              <td className="table-cell text-right font-mono text-sm text-slate-50">
                {formatCurrency(row.amount)}
              </td>
              <td className="table-cell">{statusBadge("unmatched")}</td>
              <td className="table-cell">
                <span className="text-xs" style={{ color: "#64748b" }}>
                  No match
                </span>
              </td>
              <td className="table-cell text-center">
                <span className="text-xs" style={{ color: "#64748b" }}>--</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
