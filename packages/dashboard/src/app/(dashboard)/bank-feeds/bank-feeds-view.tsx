"use client";

import type { BankConnection } from "@ledge/sdk";

interface BankFeedsViewProps {
  connections: unknown[];
  error: string | null;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "badge-green" },
  stale: { label: "Stale", className: "badge-amber" },
  disconnected: { label: "Disconnected", className: "badge-red" },
  error: { label: "Error", className: "badge-red" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BankFeedsView({ connections, error }: BankFeedsViewProps) {
  const typed = connections as BankConnection[];

  if (error === "upgrade") {
    return (
      <div>
        <PageHeader />
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "rgba(59,130,246,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h14" />
              <path d="M4 4v12" />
              <path d="M16 4v12" />
              <path d="M3 16h14" />
              <path d="M3 8h14" />
              <path d="M7 8v8" />
              <path d="M13 8v8" />
            </svg>
          </div>
          <h2
            className="font-bold"
            style={{ fontSize: 18, color: "#0A0A0A", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
          >
            Upgrade to Enable Bank Feeds
          </h2>
          <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
            Bank feed connections require a Builder plan or higher. Upgrade your plan
            to connect your bank accounts and automatically sync transactions.
          </p>
        </div>
      </div>
    );
  }

  if (error === "not-configured") {
    return (
      <div>
        <PageHeader />
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "rgba(245,158,11,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2
            className="font-bold"
            style={{ fontSize: 18, color: "#0A0A0A", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
          >
            Bank Feed Provider Not Configured
          </h2>
          <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
            The bank feed provider (Basiq) is not configured on this instance. Set the
            BASIQ_API_KEY environment variable to enable bank feed connections.
          </p>
        </div>
      </div>
    );
  }

  if (typed.length === 0) {
    return (
      <div>
        <PageHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />

      {/* Connections table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Institution</th>
              <th className="table-header" style={{ width: 120 }}>Provider</th>
              <th className="table-header" style={{ width: 120 }}>Status</th>
              <th className="table-header" style={{ width: 180 }}>Last Sync</th>
              <th className="table-header" style={{ width: 180 }}>Connected</th>
            </tr>
          </thead>
          <tbody>
            {typed.map((conn) => {
              const badge = statusBadge[conn.status] ?? { label: conn.status, className: "" };
              return (
                <tr key={conn.id} className="table-row">
                  <td className="table-cell">
                    <div className="font-medium text-sm" style={{ color: "#0A0A0A" }}>
                      {conn.institutionName || "Unknown Institution"}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "rgba(0,0,0,0.28)", marginTop: 2 }}>
                      {conn.id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-medium" style={{ color: "rgba(0,0,0,0.55)", textTransform: "capitalize" }}>
                      {conn.provider}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={badge.className}>{badge.label}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
                      {formatDate(conn.lastSyncAt)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
                      {formatDate(conn.createdAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* API guide */}
      <div style={{ marginTop: 32 }}>
        <ApiGuide />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <>
      <h1
        className="font-bold"
        style={{ fontSize: 24, color: "#0A0A0A", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
      >
        Bank Feeds
      </h1>
      <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", marginBottom: 32, lineHeight: 1.6 }}>
        Connect bank accounts to automatically sync transactions and match them
        against your ledger entries. Manage connections via the API or MCP tools.
      </p>
    </>
  );
}

function EmptyState() {
  return (
    <>
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: "rgba(59,130,246,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h14" />
            <path d="M4 4v12" />
            <path d="M16 4v12" />
            <path d="M3 16h14" />
            <path d="M3 8h14" />
            <path d="M7 8v8" />
            <path d="M13 8v8" />
          </svg>
        </div>
        <h2
          className="font-bold"
          style={{ fontSize: 18, color: "#0A0A0A", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
        >
          No Bank Connections
        </h2>
        <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
          Connect a bank account to start syncing transactions automatically.
          Use the REST API or MCP tools to create your first connection.
        </p>
      </div>

      <div style={{ marginTop: 32 }}>
        <ApiGuide />
      </div>
    </>
  );
}

function ApiGuide() {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 16 }}>How It Works</div>
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
        {steps.map((step, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
              <span
                className="flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "rgba(59,130,246,0.1)",
                  color: "#3B82F6",
                }}
              >
                {i + 1}
              </span>
              <span className="text-sm font-medium" style={{ color: "#0A0A0A" }}>
                {step.title}
              </span>
            </div>
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.36)", lineHeight: 1.6 }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>API Endpoints</div>
        <div className="card" style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header" style={{ width: 100 }}>Method</th>
                <th className="table-header">Endpoint</th>
                <th className="table-header">Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell">
                    <code className="font-mono text-xs font-medium" style={{ color: methodColor(ep.method) }}>
                      {ep.method}
                    </code>
                  </td>
                  <td className="table-cell">
                    <code className="font-mono text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
                      {ep.path}
                    </code>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>
                      {ep.description}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function methodColor(method: string): string {
  switch (method) {
    case "POST": return "#16A34A";
    case "GET": return "#3B82F6";
    case "DELETE": return "#DC2626";
    default: return "rgba(0,0,0,0.55)";
  }
}

const steps = [
  {
    title: "Connect",
    description: "Create a connection session via the API. The user authorizes access through the bank's consent flow.",
  },
  {
    title: "Sync",
    description: "Trigger a sync to pull transactions from the bank. Ledge automatically matches them against existing entries.",
  },
  {
    title: "Confirm",
    description: "Review suggested matches and confirm or ignore them. Confirmed transactions are posted to the ledger.",
  },
];

const endpoints = [
  { method: "POST", path: "/bank-feeds/connect", description: "Create a bank connection session" },
  { method: "GET", path: "/bank-feeds/connections", description: "List all bank connections" },
  { method: "GET", path: "/bank-feeds/connections/:id", description: "Get connection details" },
  { method: "DELETE", path: "/bank-feeds/connections/:id", description: "Disconnect a bank" },
  { method: "GET", path: "/bank-feeds/connections/:id/accounts", description: "List bank accounts" },
  { method: "POST", path: "/bank-feeds/accounts/:id/map", description: "Map bank account to ledger account" },
  { method: "POST", path: "/bank-feeds/accounts/:id/sync", description: "Trigger transaction sync" },
  { method: "GET", path: "/bank-feeds/sync-log", description: "View sync history" },
  { method: "GET", path: "/bank-feeds/transactions", description: "List bank transactions" },
  { method: "POST", path: "/bank-feeds/transactions/:id/confirm", description: "Confirm or ignore a match" },
];
