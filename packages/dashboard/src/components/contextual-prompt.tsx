"use client";

import { useCommandBar } from "./command-bar-provider";

export function ContextualPrompt({ placeholder }: { placeholder: string }) {
  const { open } = useCommandBar();

  return (
    <button
      onClick={() => open(placeholder)}
      className="contextual-prompt"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        borderRadius: 8,
        border: "1px solid #E5E5E5",
        backgroundColor: "transparent",
        cursor: "pointer",
        fontSize: 13,
        color: "#999999",
        fontWeight: 400,
        transition: "all 150ms ease",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      {placeholder}
    </button>
  );
}
