"use client";

import { useState } from "react";

export function CreateInvoice() {
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!client || !description || !amount) return;
    setLoading(true);
    setResult(null);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, description, amount: cents }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult(`Error: ${err.error}`);
        return;
      }

      setResult(`Invoice created: $${parseFloat(amount).toFixed(2)} for ${client}`);
      setClient("");
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
        background: "rgba(13,148,136,0.06)",
        border: "1px solid rgba(13,148,136,0.12)",
      }}
    >
      <p className="text-sm font-medium text-slate-50 mb-3">Create Invoice</p>
      <div className="flex flex-col gap-2">
        <input
          className="input"
          placeholder="Client name"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />
        <input
          className="input"
          placeholder="Description (e.g. Website Redesign)"
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
            {loading ? "Posting..." : "Create Invoice"}
          </button>
        </div>
      </div>
      {result && (
        <p className="text-xs mt-2 font-mono" style={{ color: "#5eead4" }}>
          {result}
        </p>
      )}
    </div>
  );
}
