"use client";

import { useState } from "react";

export function SimulatePayment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const simulate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const plans = [
        { plan: "Starter Monthly", amount: 2900, customer: "alice@startup.io" },
        { plan: "Pro Monthly", amount: 9900, customer: "bob@scaleup.com" },
        { plan: "Enterprise Monthly", amount: 49900, customer: "carol@bigcorp.co" },
        { plan: "Pro Annual", amount: 99900, customer: "dave@agency.dev" },
        { plan: "Starter Monthly", amount: 2900, customer: "eve@freelance.me" },
      ];
      const pick = plans[Math.floor(Math.random() * plans.length)]!;

      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pick),
      });

      if (!res.ok) {
        const err = await res.json();
        setResult(`Error: ${err.error}`);
        return;
      }

      const data = await res.json();
      setResult(`Posted $${(data.amount / 100).toFixed(2)} — ${pick.plan} (${pick.customer})`);

      // Refresh the page after a short delay to show updated statements
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 flex items-center justify-between"
      style={{
        background: "rgba(13,148,136,0.06)",
        border: "1px solid rgba(13,148,136,0.12)",
      }}
    >
      <div>
        <p className="text-sm font-medium text-slate-50">
          Simulate a Stripe Payment
        </p>
        <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
          Posts a journal entry (debit Cash, credit Subscription Revenue) just
          like the Stripe webhook would.
        </p>
        {result && (
          <p className="text-xs mt-2 font-mono" style={{ color: "#5eead4" }}>
            {result}
          </p>
        )}
      </div>
      <button className="btn-primary" onClick={simulate} disabled={loading}>
        {loading ? "Posting..." : "Simulate Payment"}
      </button>
    </div>
  );
}
