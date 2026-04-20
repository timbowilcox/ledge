"use client";

// ---------------------------------------------------------------------------
// Settings > Email tab — notification preferences, digest cadence.
// ---------------------------------------------------------------------------

import { useState, useEffect, useTransition } from "react";
import { fetchEmailPreferences, updateEmailPreferences } from "@/lib/actions";
import type { EmailPreferences } from "@/lib/actions";
import { ToggleRow } from "../_shared";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
];

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function EmailTab() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load preferences on mount
  useState(() => {
    fetchEmailPreferences().then((data) => {
      setPrefs(data);
      setLoading(false);
    });
  });

  const handleToggle = async (key: keyof EmailPreferences, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    await updateEmailPreferences({ [key]: value });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSelect = async (key: "timezone" | "digestDay", value: string) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    await updateEmailPreferences({ [key]: value });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading email preferences...</p>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>No email preferences found</p>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Email preferences will be created automatically on your next sign-in.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Save indicator */}
      {(saving || saved) && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 50,
          padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
          backgroundColor: saved ? "rgba(34, 197, 94, 0.08)" : "var(--surface-2)",
          color: saved ? "var(--positive)" : "var(--text-tertiary)",
          border: `1px solid ${saved ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
          transition: "all 200ms ease",
        }}>
          {saving ? "Saving..." : "Saved"}
        </div>
      )}

      {/* Email notifications */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Notifications</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ToggleRow
            label="Weekly digest"
            description="Financial summary sent on your chosen day"
            checked={prefs.weeklyDigest}
            onChange={(v) => handleToggle("weeklyDigest", v)}
          />
          <ToggleRow
            label="Monthly close reminder"
            description="Prompt to close your books on the 1st of each month"
            checked={prefs.monthlyClose}
            onChange={(v) => handleToggle("monthlyClose", v)}
          />
          <ToggleRow
            label="Urgent alerts"
            description="Large transactions, failed bank connections, low cash"
            checked={prefs.urgentAlerts}
            onChange={(v) => handleToggle("urgentAlerts", v)}
          />
          <ToggleRow
            label="Quarterly tax reminders"
            description="Estimated tax payment reminders each quarter"
            checked={prefs.quarterlyTax}
            onChange={(v) => handleToggle("quarterlyTax", v)}
          />
        </div>
      </div>

      {/* Schedule settings */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Schedule</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
              Timezone
            </label>
            <select
              className="input"
              value={prefs.timezone}
              onChange={(e) => handleSelect("timezone", e.target.value)}
              style={{ fontSize: 13, width: "100%" }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
              Digest Day
            </label>
            <select
              className="input"
              value={prefs.digestDay}
              onChange={(e) => handleSelect("digestDay", e.target.value)}
              style={{ fontSize: 13, width: "100%" }}
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>
          Digests are sent at 9:00 AM in your timezone on the selected day.
        </p>
      </div>
    </div>
  );
}

