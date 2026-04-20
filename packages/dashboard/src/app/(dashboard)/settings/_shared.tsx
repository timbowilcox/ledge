"use client";

// ---------------------------------------------------------------------------
// Settings — cross-tab shared helpers.
// Extracted from the original 2,058-line settings-view.tsx.
// ---------------------------------------------------------------------------

import { useState, useRef } from "react";

export const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function FiscalYearLocked({ month }: { month: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-2" style={{ position: "relative" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
        {MONTH_NAMES[month]}
      </span>
      <div
        style={{ position: "relative", display: "inline-flex", cursor: "help" }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        {showTooltip && (
          <div
            ref={tooltipRef}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text-secondary)",
              maxWidth: 240,
              whiteSpace: "normal",
              lineHeight: 1.5,
              zIndex: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          >
            Changing fiscal year after closing periods would break your historical statements. Contact support if restructuring is needed.
          </div>
        )}
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between" style={{ paddingBottom: 16, borderBottom: "1px solid var(--surface-3)" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "none",
          cursor: "pointer",
          backgroundColor: checked ? "var(--accent)" : "var(--border)",
          position: "relative",
          transition: "background-color 200ms ease",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "var(--surface-1)",
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          transition: "left 200ms ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.24)",
        }} />
      </button>
    </div>
  );
}

