"use client";

import Link from "next/link";

const NEXT_TIER: Record<string, string> = {
  free: "Builder",
  builder: "Pro",
  pro: "Platform",
};

const NEXT_TIER_LIMIT: Record<string, Record<string, string>> = {
  free: { transactions: "1,000/month", invoices: "unlimited", customers: "unlimited", ledgers: "3", fixedAssets: "unlimited" },
  builder: { transactions: "10,000/month", invoices: "unlimited", customers: "unlimited", ledgers: "10", fixedAssets: "unlimited" },
  pro: { transactions: "unlimited", invoices: "unlimited", customers: "unlimited", ledgers: "unlimited", fixedAssets: "unlimited" },
};

interface UsageLimitBannerProps {
  resource: string;
  used: number;
  limit: number | null;
  tier: string;
}

export function UsageLimitBanner({ resource, used, limit, tier }: UsageLimitBannerProps) {
  if (limit === null) return null;
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  if (pct < 80) return null;

  const atLimit = pct >= 100;
  const nextTier = NEXT_TIER[tier] ?? "a higher plan";
  const nextLimit = NEXT_TIER_LIMIT[tier]?.[resource] ?? "more";
  const label = resource === "fixedAssets" ? "fixed assets" : resource;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        border: atLimit
          ? "1px solid color-mix(in srgb, var(--negative) 30%, transparent)"
          : "1px solid color-mix(in srgb, #D97706 30%, transparent)",
        backgroundColor: atLimit
          ? "color-mix(in srgb, var(--negative) 8%, var(--surface-1))"
          : "color-mix(in srgb, #D97706 8%, var(--surface-1))",
        marginBottom: 16,
      }}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={atLimit ? "var(--negative)" : "#D97706"}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        {atLimit ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        ) : (
          <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )}
      </svg>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
        {atLimit
          ? `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached (${used.toLocaleString()}/${limit.toLocaleString()}). Upgrade to continue.`
          : `You've used ${used.toLocaleString()} of ${limit.toLocaleString()} ${label} this month. Upgrade to ${nextTier} for ${nextLimit}.`}
      </span>
      <Link
        href="/settings?tab=billing"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: atLimit ? "var(--negative)" : "#D97706",
          whiteSpace: "nowrap",
        }}
      >
        {atLimit ? "Upgrade now" : "Upgrade"} &rarr;
      </Link>
    </div>
  );
}
