"use client";

// ---------------------------------------------------------------------------
// Settings > Recurring tab — recurring journal entry management.
// ---------------------------------------------------------------------------

import { useState, useEffect, useTransition } from "react";
import { formatDate } from "@/lib/format";
import {
  fetchRecurringEntries,
  deleteRecurringEntryAction,
  pauseRecurringEntryAction,
  resumeRecurringEntryAction,
} from "@/lib/actions";

interface RecurringEntryView {
  id: string;
  description: string;
  lineItems: { accountId: string; amount: number; direction: string }[];
  frequency: string;
  dayOfMonth: number | null;
  nextRunDate: string;
  lastRunDate: string | null;
  autoReverse: boolean;
  isActive: boolean;
  createdAt: string;
}

export function RecurringTab() {
  const [entries, setEntries] = useState<RecurringEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useState(() => {
    fetchRecurringEntries().then((data) => {
      setEntries(data as RecurringEntryView[]);
      setLoading(false);
    });
  });

  const fmtAmount = (items: RecurringEntryView["lineItems"]) => {
    const total = items.filter(l => l.direction === "debit").reduce((s, l) => s + l.amount, 0);
    return "$" + (total / 100).toFixed(2);
  };

  const fmtFreq = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

  const handlePauseResume = (entry: RecurringEntryView) => {
    startTransition(async () => {
      if (entry.isActive) {
        await pauseRecurringEntryAction(entry.id);
      } else {
        await resumeRecurringEntryAction(entry.id);
      }
      const updated = await fetchRecurringEntries();
      setEntries(updated as RecurringEntryView[]);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteRecurringEntryAction(id);
      const updated = await fetchRecurringEntries();
      setEntries(updated as RecurringEntryView[]);
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading recurring entries...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recurring Entries</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Automated periodic journal postings</p>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>{entries.length} entries</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>No recurring entries</p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Create recurring entries via the API, SDK, or MCP.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Description</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Frequency</th>
                <th className="table-header">Next Run</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="table-row">
                  <td className="table-cell" style={{ fontSize: 13, fontWeight: 500 }}>
                    {entry.description}
                    {entry.autoReverse && (
                      <span style={{ fontSize: 10, color: "#D97706", marginLeft: 8, fontWeight: 600 }}>AUTO-REVERSE</span>
                    )}
                  </td>
                  <td className="table-cell text-right font-mono" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    {fmtAmount(entry.lineItems)}
                  </td>
                  <td className="table-cell">
                    <span className="badge badge-blue">{fmtFreq(entry.frequency)}</span>
                  </td>
                  <td className="table-cell" style={{ fontSize: 13 }}>{entry.nextRunDate}</td>
                  <td className="table-cell">
                    <span className={"badge " + (entry.isActive ? "badge-green" : "badge-red")}>
                      {entry.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12 }}
                        onClick={() => handlePauseResume(entry)}
                        disabled={isPending}
                      >
                        {entry.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, color: "var(--negative)" }}
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
