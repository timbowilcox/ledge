"use client";

import { useState } from "react";

export function MarkPaid() {
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!client || !amount) return;
    setLoading(true);
    setResult(null);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, amount: cents }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult(`Error: ${err.error}`);
        return;
      }

      setResult(`Payment received: $${parseFloat(amount).toFixed(2)} from ${client}`);
      setClient("");
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
        background: "rgba(34,197,94,0.04)",
        border: "1px solid rgba(34,197,94,0.12)",
      }}
    >
      <p className="text-sm font-medium text-slate-50 mb-3">Record Payment</p>
      <div className="flex flex-col gap-2">
        <input
          className="input"
          placeholder="Client name"
          value={client}
          onChange={(e) => setClient(e.target.value)}
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
            {loading ? "Posting..." : "Record Payment"}
          </button>
        </div>
      </div>
      {result && (
        <p className="text-xs mt-2 font-mono" style={{ color: "#22c55e" }}>
          {result}
        </p>
      )}
    </div>
  );
}
