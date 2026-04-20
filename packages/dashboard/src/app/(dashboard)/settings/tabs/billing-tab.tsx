"use client";

// ---------------------------------------------------------------------------
// Settings > Subscription tab — plan info, usage, checkout/portal controls.
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";
import { createCheckoutSession, createPortalSession } from "@/lib/actions";
import type { BillingStatus, TierUsage } from "@/lib/actions";

const TIER_ORDER = ["free", "builder", "pro", "platform"];

const PLAN_TIERS = [
  {
    name: "Free", price: "$0", period: "/month", plan: "free" as const,
    features: ["100 transactions/month", "5 invoices/month", "3 customers", "1 ledger", "MCP access", "Basic statements"],
  },
  {
    name: "Builder", price: "$19", period: "/month", plan: "builder" as const, recommended: true,
    features: ["1,000 transactions/month", "Unlimited invoices", "Unlimited customers", "3 ledgers", "API & SDK access", "PDF export & email"],
  },
  {
    name: "Pro", price: "$49", period: "/month", plan: "pro" as const,
    features: ["10,000 transactions/month", "10 ledgers", "Revenue recognition", "Multi-currency", "Custom chart of accounts", "Consolidated view"],
  },
  {
    name: "Platform", price: "$149", period: "/month", plan: "platform" as const,
    features: ["Unlimited everything", "Programmatic provisioning", "Webhooks", "White-label", "Unlimited ledgers", "Priority support"],
  },
];

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
          <span className="font-mono" style={{ fontSize: 13, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
            {used.toLocaleString()} (unlimited)
          </span>
        </div>
      </div>
    );
  }
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct >= 90 ? "var(--negative)" : pct >= 70 ? "#D97706" : "var(--positive)";
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-mono" style={{ fontSize: 13, color: pct >= 90 ? "var(--negative)" : "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 3, backgroundColor: barColor, transition: "width 600ms ease" }} />
      </div>
    </div>
  );
}

export function BillingTab({ billing, tierUsage }: { billing: BillingStatus; tierUsage: TierUsage }) {
  const [isPending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  const isFree = tierUsage.tier === "free";

  const handleUpgrade = () => {
    setRedirecting(true);
    startTransition(async () => {
      try {
        const url = await createCheckoutSession();
        window.location.href = url;
      } catch { setRedirecting(false); }
    });
  };

  const handleManage = () => {
    setRedirecting(true);
    startTransition(async () => {
      try {
        const url = await createPortalSession();
        window.location.href = url;
      } catch { setRedirecting(false); }
    });
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "\u2014";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const planLabel = (plan: string) => {
    switch (plan) { case "builder": return "Builder"; case "pro": return "Pro"; case "platform": return "Platform"; default: return "Free"; }
  };

  const planPrice = (plan: string) => {
    switch (plan) { case "builder": return "$19/mo"; case "pro": return "$49/mo"; case "platform": return "$149/mo"; default: return "$0/mo"; }
  };

  const tierDescriptions: Record<string, string> = {
    free: "100 transactions, 5 invoices, 3 customers per month.",
    builder: "1,000 transactions/month. Unlimited invoices and customers.",
    pro: "10,000 transactions/month. Revenue recognition and consolidated view.",
    platform: "Unlimited everything. Programmatic provisioning and white-label.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Plan card */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 12 }}>Current Plan</div>
        <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
          <span className="font-mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {planLabel(tierUsage.tier)}
          </span>
          <span className={"badge " + (isFree ? "badge-blue" : "badge-green")}>{planPrice(tierUsage.tier)}</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {tierDescriptions[tierUsage.tier] || tierDescriptions.free}
        </p>
        {!isFree && billing.periodEnd && (
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
            Current period: {fmtDate(billing.periodStart)} {"\u2014"} {fmtDate(billing.periodEnd)}
          </p>
        )}
      </div>

      {/* Usage card */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 4 }}>Usage this billing period</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>
          {fmtDate(tierUsage.period.start)} {"\u2014"} {fmtDate(tierUsage.period.end)}
        </div>

        <UsageBar label="Transactions" used={tierUsage.transactions.used} limit={tierUsage.transactions.limit} />
        <UsageBar label="Invoices" used={tierUsage.invoices.used} limit={tierUsage.invoices.limit} />
        <UsageBar label="Customers" used={tierUsage.customers.used} limit={tierUsage.customers.limit} />
        <UsageBar label="Ledgers" used={tierUsage.ledgers.used} limit={tierUsage.ledgers.limit} />
        <UsageBar label="Fixed Assets" used={tierUsage.fixedAssets.used} limit={tierUsage.fixedAssets.limit} />

        {isFree && (
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8, lineHeight: 1.6 }}>
            Free includes 100 transactions/month. Builder includes 1,000.{" "}
            <span style={{ color: "var(--text-secondary)", cursor: "pointer" }} onClick={() => document.getElementById("plan-tiers")?.scrollIntoView({ behavior: "smooth" })}>
              Compare plans &darr;
            </span>
          </p>
        )}
      </div>

      {/* Action card */}
      <div className="card">
        {isFree ? (
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Upgrade</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Get more transactions, unlimited invoices, PDF export, and bank feed integration.
            </p>
            <button className="btn-primary" onClick={handleUpgrade} disabled={isPending || redirecting}>
              {redirecting ? "Redirecting to Stripe..." : "Upgrade to Builder \u2014 $19/month"}
            </button>
          </div>
        ) : (
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>Manage Subscription</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
              Update payment method, view invoices, or cancel your subscription.
            </p>
            <button className="btn-secondary" onClick={handleManage} disabled={isPending || redirecting}>
              {redirecting ? "Redirecting to Stripe..." : "Manage Subscription"}
            </button>
          </div>
        )}
      </div>

      {/* Plan tiers */}
      <div id="plan-tiers">
        <div className="section-label" style={{ marginBottom: 16 }}>Plans</div>
        <div className="grid grid-cols-4" style={{ gap: 12 }}>
          {PLAN_TIERS.map((tier) => {
            const isCurrent = tierUsage.tier === tier.plan;
            const isRecommended = tier.recommended && isFree;
            return (
              <div
                key={tier.plan}
                className="card"
                style={{
                  position: "relative",
                  border: isRecommended ? "2px solid var(--accent)" : isCurrent ? "1px solid var(--border-strong)" : "1px solid var(--border)",
                  borderLeft: isCurrent ? "3px solid var(--accent)" : undefined,
                  padding: 16,
                  opacity: 1,
                }}
              >
                {isRecommended && (
                  <div
                    className="text-xs font-medium"
                    style={{
                      position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                      backgroundColor: "var(--accent)", color: "white",
                      padding: "2px 12px", borderRadius: 10, whiteSpace: "nowrap",
                    }}
                  >
                    Recommended
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{tier.price}</span>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{tier.period}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 12 }}>
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2" style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 5, lineHeight: 1.5 }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                        <path d="M3.5 7l2 2 5-5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ textAlign: "center", backgroundColor: "var(--surface-1)", color: "var(--accent)", border: "1px solid var(--border-strong)", borderRadius: 9999, padding: "4px 12px" }}>
                    Current plan
                  </div>
                ) : TIER_ORDER.indexOf(tier.plan) > TIER_ORDER.indexOf(tierUsage.tier) ? (
                  <button className="btn-primary" style={{ width: "100%", padding: "8px 0", fontSize: 12 }} onClick={handleUpgrade} disabled={isPending || redirecting}>
                    {redirecting ? "Redirecting..." : "Upgrade"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
