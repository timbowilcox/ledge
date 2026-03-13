"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/format";
import { createApiKey, revokeApiKey, fetchApiKeys, createCheckoutSession, createPortalSession } from "@/lib/actions";
import { CopyButton } from "@/components/copy-button";
import type { ApiKeySafe } from "@ledge/sdk";
import type { BillingStatus } from "@/lib/actions";

// ── Types ──────────────────────────────────────────────────────────────────

type SettingsTab = "general" | "currencies" | "api-keys" | "billing";

interface Props {
  ledger: { name: string; currency: string; accountingBasis: string; templateId: string | null; createdAt: string };
  billing: BillingStatus;
  initialKeys: ApiKeySafe[];
  currencies: any[];
  exchangeRates: any[];
}

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "currencies", label: "Currencies" },
  { key: "api-keys", label: "API Keys" },
  { key: "billing", label: "Billing" },
];

// ── Main component ─────────────────────────────────────────────────────────

export function SettingsView({ ledger, billing, initialKeys, currencies, exchangeRates }: Props) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "general";
  const [activeTab, setActiveTab] = useState<SettingsTab>(TABS.some(t => t.key === initialTab) ? initialTab : "general");

  return (
    <div>
      <h1
        className="font-bold"
        style={{ fontSize: 24, color: "#0A0A0A", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
      >
        Settings
      </h1>
      <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", marginBottom: 28 }}>
        Manage your ledger configuration, API keys, and billing.
      </p>

      {/* Horizontal tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid rgba(0,0,0,0.10)",
          marginBottom: 32,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                window.history.replaceState(null, "", "/settings?tab=" + tab.key);
              }}
              style={{
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#3B82F6" : "rgba(0,0,0,0.45)",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #3B82F6" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "general" && <GeneralTab ledger={ledger} />}
      {activeTab === "currencies" && <CurrenciesTab currencies={currencies} exchangeRates={exchangeRates} />}
      {activeTab === "api-keys" && <ApiKeysTab initialKeys={initialKeys} />}
      {activeTab === "billing" && <BillingTab billing={billing} />}
    </div>
  );
}

// ── General Tab ────────────────────────────────────────────────────────────

function GeneralTab({ ledger }: { ledger: Props["ledger"] }) {
  const { data: session } = useSession();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Account info */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Account</div>
        {session?.user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.10)" }}
                />
              )}
              <div>
                <div className="text-sm font-medium" style={{ color: "#0A0A0A" }}>{session.user.name}</div>
                <div className="text-xs" style={{ color: "rgba(0,0,0,0.36)" }}>{session.user.email}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ledger info */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Ledger</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <InfoRow label="Name" value={ledger.name} />
          <InfoRow label="Template" value={ledger.templateId ?? "Custom"} />
          <InfoRow label="Currency" value={ledger.currency} />
          <InfoRow label="Accounting Basis" value={ledger.accountingBasis} />
          <InfoRow label="Created" value={formatDate(ledger.createdAt)} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "rgba(0,0,0,0.36)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        {label}
      </div>
      <div className="text-sm font-medium" style={{ color: "#0A0A0A" }}>{value}</div>
    </div>
  );
}

// ── Currencies Tab ─────────────────────────────────────────────────────────

function CurrenciesTab({ currencies, exchangeRates }: { currencies: any[]; exchangeRates: any[] }) {
  const fmtRate = (rate: number) => (rate / 1_000_000).toFixed(6);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Enabled currencies */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#0A0A0A" }}>Enabled Currencies</h2>
              <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)", marginTop: 2 }}>Currencies available for transactions</p>
            </div>
            <span className="badge badge-blue">{currencies.length}</span>
          </div>
        </div>

        {currencies.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💱</div>
            <p className="text-sm font-medium" style={{ color: "#0A0A0A", marginBottom: 4 }}>No additional currencies</p>
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)" }}>Enable currencies via the API or MCP.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Currency</th>
                <th className="table-header">Symbol</th>
                <th className="table-header">Decimals</th>
                <th className="table-header">Status</th>
                <th className="table-header">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c: any) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-mono text-sm font-semibold" style={{ color: "#3B82F6" }}>{c.currencyCode}</td>
                  <td className="table-cell text-sm">{c.symbol}</td>
                  <td className="table-cell text-sm">{c.decimalPlaces}</td>
                  <td className="table-cell"><span className={"badge " + (c.enabled ? "badge-green" : "badge-red")}>{c.enabled ? "Active" : "Disabled"}</span></td>
                  <td className="table-cell text-sm">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Exchange rates */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#0A0A0A" }}>Exchange Rates</h2>
              <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)", marginTop: 2 }}>Stored rates for currency conversion</p>
            </div>
            <span className="badge badge-blue">{exchangeRates.length}</span>
          </div>
        </div>

        {exchangeRates.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <p className="text-sm font-medium" style={{ color: "#0A0A0A", marginBottom: 4 }}>No exchange rates</p>
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)" }}>Set rates via the API or MCP.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">From</th>
                <th className="table-header">To</th>
                <th className="table-header text-right">Rate</th>
                <th className="table-header">Effective</th>
                <th className="table-header">Source</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRates.map((r: any) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-mono text-sm font-semibold">{r.fromCurrency}</td>
                  <td className="table-cell font-mono text-sm font-semibold">{r.toCurrency}</td>
                  <td className="table-cell text-right font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtRate(r.rate)}</td>
                  <td className="table-cell text-sm">{fmtDate(r.effectiveDate)}</td>
                  <td className="table-cell"><span className="badge badge-blue">{r.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── API Keys Tab ───────────────────────────────────────────────────────────

function ApiKeysTab({ initialKeys }: { initialKeys: ApiKeySafe[] }) {
  const [keys, setKeys] = useState<ApiKeySafe[]>(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mcpExpanded, setMcpExpanded] = useState(false);

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    startTransition(async () => {
      const result = await createApiKey(newKeyName.trim());
      setCreatedKey(result.rawKey);
      setNewKeyName("");
      const updated = await fetchApiKeys();
      setKeys(updated);
    });
  };

  const handleRevoke = (keyId: string) => {
    startTransition(async () => {
      await revokeApiKey(keyId);
      const updated = await fetchApiKeys();
      setKeys(updated);
      setConfirmRevoke(null);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Keys table */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-label">API Keys</div>
          <button className="btn-primary text-sm" style={{ padding: "8px 16px" }} onClick={() => setShowCreateModal(true)}>
            Create new key
          </button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Key</th>
                <th className="table-header">Created</th>
                <th className="table-header">Last Used</th>
                <th className="table-header text-right">Status</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="table-row">
                  <td className="table-cell text-sm font-medium">{key.name}</td>
                  <td className="table-cell font-mono text-xs" style={{ color: "#3B82F6" }}>{key.prefix}...</td>
                  <td className="table-cell text-sm">{formatDate(key.createdAt)}</td>
                  <td className="table-cell text-sm">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</td>
                  <td className="table-cell text-right">
                    <span className={"badge " + (key.status === "active" ? "badge-green" : "badge-red")}>{key.status}</span>
                  </td>
                  <td className="table-cell text-right">
                    {key.status === "active" && (
                      confirmRevoke === key.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-xs" style={{ color: "#DC2626" }}>Confirm?</span>
                          <button className="text-xs font-medium" style={{ color: "#DC2626", background: "none", border: "none", cursor: "pointer" }} onClick={() => handleRevoke(key.id)}>Yes</button>
                          <button className="btn-ghost text-xs" onClick={() => setConfirmRevoke(null)}>No</button>
                        </span>
                      ) : (
                        <button className="btn-ghost text-xs" onClick={() => setConfirmRevoke(key.id)}>Revoke</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-sm" style={{ color: "rgba(0,0,0,0.36)", padding: 48 }}>
                    No API keys yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MCP Guide collapsible */}
      <div className="card" style={{ padding: 0 }}>
        <button
          onClick={() => setMcpExpanded(!mcpExpanded)}
          className="flex items-center justify-between w-full"
          style={{ padding: "20px 24px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: "#0A0A0A" }}>MCP Connection Guide</div>
            <div className="text-xs" style={{ color: "rgba(0,0,0,0.36)", marginTop: 2 }}>Connect Ledge to Claude Code or Cursor</div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(0,0,0,0.36)" strokeWidth="1.5"
            style={{ transform: mcpExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {mcpExpanded && (
          <div style={{ padding: "0 24px 24px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <McpGuideContent />
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!createdKey) setShowCreateModal(false); }}
        >
          <div className="card" style={{ width: 500, padding: 36, transform: "translateY(-20px)" }} onClick={(e) => e.stopPropagation()}>
            {!createdKey ? (
              <>
                <h2 className="font-bold" style={{ fontSize: 20, marginBottom: 20, fontFamily: "var(--font-family-display)" }}>Create API Key</h2>
                <input
                  type="text"
                  className="input"
                  style={{ marginBottom: 20 }}
                  placeholder="Key name (e.g. Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <div className="flex justify-end" style={{ gap: 12 }}>
                  <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleCreate} disabled={isPending}>
                    {isPending ? "Creating..." : "Create"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-bold" style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--font-family-display)" }}>Key Created</h2>
                <p className="text-sm" style={{ color: "#D97706", marginBottom: 20 }}>
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div
                  className="flex items-center justify-between"
                  style={{ borderRadius: 14, padding: 16, marginBottom: 20, gap: 12, backgroundColor: "#F7F7F6", border: "1px solid rgba(0,0,0,0.10)" }}
                >
                  <code className="text-sm font-mono" style={{ color: "#3B82F6", wordBreak: "break-all" }}>{createdKey}</code>
                  <CopyButton text={createdKey} />
                </div>
                <div className="flex justify-end">
                  <button className="btn-primary" onClick={() => { setCreatedKey(null); setShowCreateModal(false); }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MCP Guide Content ──────────────────────────────────────────────────────

function McpGuideContent() {
  const [activeTool, setActiveTool] = useState<"claude-code" | "cursor">("claude-code");

  const configs = {
    "claude-code": {
      label: "Claude Code",
      file: ".claude/settings.json",
      config: `{
  "mcpServers": {
    "ledge": {
      "command": "npx",
      "args": ["@ledge/mcp@latest"],
      "env": {
        "LEDGE_API_KEY": "YOUR_API_KEY_HERE",
        "LEDGE_API_URL": "http://localhost:3100"
      }
    }
  }
}`,
    },
    cursor: {
      label: "Cursor",
      file: ".cursor/mcp.json",
      config: `{
  "mcpServers": {
    "ledge": {
      "command": "npx",
      "args": ["@ledge/mcp@latest"],
      "env": {
        "LEDGE_API_KEY": "YOUR_API_KEY_HERE",
        "LEDGE_API_URL": "http://localhost:3100"
      }
    }
  }
}`,
    },
  };

  const cfg = configs[activeTool];

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="flex" style={{ gap: 6, marginBottom: 20 }}>
        {(["claude-code", "cursor"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTool === key ? "rgba(59,130,246,0.1)" : "transparent",
              color: activeTool === key ? "#3B82F6" : "rgba(0,0,0,0.36)",
              border: activeTool === key ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            {configs[key].label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="text-xs font-medium" style={{ color: "rgba(0,0,0,0.36)" }}>
          <code className="font-mono" style={{ color: "#3B82F6" }}>{cfg.file}</code>
        </div>
        <CopyButton text={cfg.config} label="Copy" />
      </div>
      <div
        style={{
          borderRadius: 12,
          padding: 16,
          backgroundColor: "#F3F3F1",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        <pre className="font-mono text-xs overflow-x-auto" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>
          {cfg.config}
        </pre>
      </div>
    </div>
  );
}

// ── Billing Tab ────────────────────────────────────────────────────────────

function BillingTab({ billing }: { billing: BillingStatus }) {
  const [isPending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  const isFree = billing.plan === "free";
  const limit = billing.usage.limit ?? Infinity;
  const pct = limit === Infinity ? 0 : Math.min((billing.usage.count / limit) * 100, 100);
  const barColor = pct >= 100 ? "#DC2626" : pct >= 80 ? "#D97706" : "#3B82F6";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="grid grid-cols-2" style={{ gap: 20 }}>
        {/* Current Plan */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 14 }}>Current Plan</div>
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <span className="font-bold" style={{ fontSize: 28, color: "#0A0A0A", letterSpacing: "-0.02em", fontFamily: "var(--font-family-display)" }}>
              {planLabel(billing.plan)}
            </span>
            <span className={"badge " + (isFree ? "badge-blue" : "badge-green")}>{planPrice(billing.plan)}</span>
          </div>
          <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>
            {isFree ? "500 transactions per month." : "Unlimited transactions. All features unlocked."}
          </p>
        </div>

        {/* Usage */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 14 }}>Monthly Usage</div>
          <div className="flex items-baseline gap-2" style={{ marginBottom: 14 }}>
            <span className="font-bold font-mono" style={{ fontSize: 28, color: pct >= 100 ? "#DC2626" : "#0A0A0A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {billing.usage.count.toLocaleString()}
            </span>
            <span className="text-sm" style={{ color: "rgba(0,0,0,0.36)" }}>
              {billing.usage.limit != null ? `/ ${billing.usage.limit.toLocaleString()} transactions` : "transactions (unlimited)"}
            </span>
          </div>
          {billing.usage.limit != null && (
            <div style={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: pct + "%", height: "100%", borderRadius: 4, backgroundColor: barColor, transition: "width 600ms cubic-bezier(0.16, 1, 0.3, 1)" }} />
            </div>
          )}
          <div className="text-xs" style={{ color: "rgba(0,0,0,0.36)" }}>Resets on {fmtDate(billing.nextResetDate)}</div>
        </div>
      </div>

      {/* Pending notice */}
      {billing.pendingTransactions > 0 && (
        <div style={{ borderRadius: 18, padding: "20px 24px", backgroundColor: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.15)" }}>
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" /><path d="M10 6.5v4" /><circle cx="10" cy="13.5" r="0.5" fill="#D97706" />
            </svg>
            <span className="text-sm font-medium" style={{ color: "#92400E" }}>
              {billing.pendingTransactions} transaction{billing.pendingTransactions !== 1 ? "s" : ""} queued
            </span>
          </div>
        </div>
      )}

      {/* Action card */}
      <div className="card">
        {isFree ? (
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>Upgrade</div>
            <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
              Get unlimited transactions, instant posting, and bank feed integration.
            </p>
            <button className="btn-primary" style={{ padding: "12px 28px", fontSize: 14 }} onClick={handleUpgrade} disabled={isPending || redirecting}>
              {redirecting ? "Redirecting to Stripe..." : "Upgrade to Builder \u2014 $19/month"}
            </button>
          </div>
        ) : (
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>Manage Subscription</div>
            <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6, marginBottom: 8 }}>
              Update payment method, view invoices, or cancel your subscription.
            </p>
            {billing.periodEnd && (
              <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)", marginBottom: 20 }}>
                Current period: {fmtDate(billing.periodStart)} {"\u2014"} {fmtDate(billing.periodEnd)}
              </p>
            )}
            <button className="btn-secondary" style={{ padding: "12px 28px", fontSize: 14 }} onClick={handleManage} disabled={isPending || redirecting}>
              {redirecting ? "Redirecting to Stripe..." : "Manage Subscription"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
