"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { updateUserNameAction } from "@/lib/actions";

/**
 * Modal shown after sign-in when the user's name is missing or is a fallback.
 * Captures first name and last name, saves to the users table.
 */
export function NameCaptureModal() {
  const { data: session, update } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if we already have a real name, or if dismissed
  if (dismissed) return null;
  if (!session?.user) return null;

  const currentName = session.user.name ?? "";
  const isFallbackName =
    !currentName ||
    currentName === "Kounta User" ||
    currentName === session.user.email?.split("@")[0];

  if (!isFallbackName) return null;

  // Check localStorage to not re-show after dismiss
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("kounta_name_captured");
    if (stored) return null;
  }

  const handleSubmit = () => {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!fullName) return;

    startTransition(async () => {
      const ok = await updateUserNameAction(fullName);
      if (ok) {
        // Update the client session with the new name
        await update({ name: fullName });
        if (typeof window !== "undefined") {
          localStorage.setItem("kounta_name_captured", "true");
        }
        setDismissed(true);
        // Reload to refresh server components with the new name
        window.location.reload();
      }
    });
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kounta_name_captured", "true");
    }
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        animation: "modal-fade-in 200ms ease",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--surface-1)",
          borderRadius: "0.75rem",
          border: "1px solid var(--border-strong)",
          padding: "2rem",
          width: "25rem",
          maxWidth: "90vw",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)",
          animation: "modal-slide-up 200ms ease",
        }}
      >
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          Welcome to Kounta!
        </h2>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-tertiary)",
            marginBottom: "1.5rem",
          }}
        >
          What should we call you?
        </p>

        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                marginBottom: "0.375rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
              }}
            >
              First name
            </label>
            <input
              className="input"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Tim"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstName.trim()) handleSubmit();
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                marginBottom: "0.375rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
              }}
            >
              Last name
            </label>
            <input
              className="input"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Wilcox"
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstName.trim()) handleSubmit();
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={handleSkip}
            className="btn-ghost"
            style={{
              border: "none",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={!firstName.trim() || isPending}
            style={{
              opacity: !firstName.trim() || isPending ? 0.5 : 1,
              cursor: !firstName.trim() || isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
