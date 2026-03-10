"use client";

import { useState } from "react";

const EXPENSE_ACCOUNTS = [
  { code: "5000", name: "Subcontractor Costs" },
  { code: "6000", name: "Salaries & Benefits" },
  { code: "6100", name: "Travel & Entertainment" },
  { code: "6200", name: "Professional Development" },
  { code: "6300", name: "Insurance" },
  { code: "6400", name: "General & Administrative" },
];

export function RecordExpense() {
  const [accountCode, setAccountCode] = useState("6400");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!description || !amount) return;
    setLoading(true);
    setResult(null);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, description, amount: cents }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult(`Error: ${err.error}`);
        return;
      }

      const acctName = EXPENSE_ACCOUNTS.find((a) => a.code === accountCode)?.name;
      setResult(`Expense recorded: $${parseFloat(amount).toFixed(2)} — ${acctName}`);
      setDescription("");
      setAmount("");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(239,68,68,0.04)",
        border: "1px solid rgba(239,68,68,0.12)",
      }}
    >
      <p className="text-sm font-medium text-slate-50 mb-3">Record Expense</p>
      <div className="flex flex-col gap-2">
        <select
          className="input"
          value={accountCode}
          onChange={(e) => setAccountCode(e.target.value)}
        >
          {EXPENSE_ACCOUNTS.map((acct) => (
            <option key={acct.code} value={acct.code}>
              {acct.code} — {acct.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Description (e.g. Flight to NYC)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" onClick={submit} disabled={loading}>
            {loading ? "Posting..." : "Record Expense"}
          </button>
        </div>
      </div>
      {result && (
        <p className="text-xs mt-2 font-mono" style={{ color: "#ef4444" }}>
          {result}
        </p>
      )}
    </div>
  );
}
