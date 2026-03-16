"use client";

import Link from "next/link";

const TIER_PRICES: Record<string, string> = {
  builder: "$19/month",
  pro: "$49/month",
  platform: "$149/month",
};

interface UpgradePromptProps {
  feature: string;
  message: string;
  currentTier: string;
  requiredTier: string;
  compact?: boolean;
}

export function UpgradePrompt({ feature, message, currentTier, requiredTier, compact }: UpgradePromptProps) {
  const tierLabel = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);
  const price = TIER_PRICES[requiredTier] ?? "";

  if (compact) {
    return (
      <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M8 3v10M5 6l3-3 3 3" />
        </svg>
        <span>{message}</span>
        <span style={{ color: "var(--text-tertiary)" }}>&mdash;</span>
        <Link href="/settings?tab=billing" style={{ color: "var(--accent)", fontWeight: 500, whiteSpace: "nowrap" }}>
          Upgrade &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))",
        backgroundColor: "color-mix(in srgb, var(--accent) 5%, var(--surface-1))",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v10M5 6l3-3 3 3" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          Upgrade to unlock
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
        {message}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>
        Available on {tierLabel}{price ? ` (${price})` : ""}
      </p>
      <div className="flex items-center gap-3">
        <Link href="/settings?tab=billing" className="btn-primary" style={{ fontSize: 13, padding: "8px 20px" }}>
          View plans
        </Link>
      </div>
    </div>
  );
}
