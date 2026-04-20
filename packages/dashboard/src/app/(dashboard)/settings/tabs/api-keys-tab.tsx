"use client";

// ---------------------------------------------------------------------------
// Settings > API Keys tab — key management + MCP integration guide.
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import { createApiKey, revokeApiKey, fetchApiKeys } from "@/lib/actions";
import { CopyButton } from "@/components/copy-button";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import type { ApiKeySafe } from "@kounta/sdk";

export function ApiKeysTab({ initialKeys, currentTier = "free" }: { initialKeys: ApiKeySafe[]; currentTier?: string }) {
  // Free tier: show upgrade prompt instead of API keys
  if (currentTier === "free") {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto" }}>
        <UpgradePrompt
          feature="apiAccess"
          message="API and SDK access is available on Builder ($19/month). Upgrade to generate API keys and integrate Kounta into your application."
          currentTier={currentTier}
          requiredTier="builder"
        />
      </div>
    );
  }

  const [keys, setKeys] = useState<ApiKeySafe[]>(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  // Filter out dashboard session keys (internal, not user-created)
  const userKeys = keys.filter((k) => !k.name.startsWith("dashboard-"));
  const activeKeys = userKeys.filter((k) => k.status === "active");
  const revokedKeys = userKeys.filter((k) => k.status === "revoked");
  const displayKeys = showRevoked ? userKeys : activeKeys;

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
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCreateModal(true)}>
            Create new key
          </button>
        </div>

        {activeKeys.length === 0 && !showRevoked ? (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No API keys yet</div>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", maxWidth: 360, margin: "0 auto 20px" }}>
              Create an API key to connect your app to Kounta via the REST API or SDK.
            </p>
            <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCreateModal(true)}>
              Create new key
            </button>
            {revokedKeys.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setShowRevoked(true)}
                  style={{ fontSize: 12, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  Show revoked keys ({revokedKeys.length})
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0 }}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Key</th>
                    <th className="table-header">Created</th>
                    <th className="table-header">Last Used</th>
                    <th className="table-header" style={{ textAlign: "right" }}>Status</th>
                    <th className="table-header" style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayKeys.map((key) => (
                    <tr key={key.id} className="table-row" style={{ opacity: key.status === "revoked" ? 0.5 : 1 }}>
                      <td className="table-cell" style={{ fontSize: 13, fontWeight: 500 }}>{key.name}</td>
                      <td className="table-cell font-mono" style={{ fontSize: 12, color: "var(--accent)" }}>{key.prefix}...</td>
                      <td className="table-cell" style={{ fontSize: 13 }}>{formatDate(key.createdAt)}</td>
                      <td className="table-cell" style={{ fontSize: 13 }}>{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</td>
                      <td className="table-cell" style={{ textAlign: "right" }}>
                        <span className={"badge " + (key.status === "active" ? "badge-green" : "badge-red")}>{key.status}</span>
                      </td>
                      <td className="table-cell" style={{ textAlign: "right" }}>
                        {key.status === "active" && (
                          confirmRevoke === key.id ? (
                            <span className="flex items-center justify-end gap-2">
                              <span style={{ fontSize: 12, color: "var(--negative)" }}>Confirm?</span>
                              <button style={{ fontSize: 12, fontWeight: 500, color: "var(--negative)", background: "none", border: "none", cursor: "pointer" }} onClick={() => handleRevoke(key.id)}>Yes</button>
                              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmRevoke(null)}>No</button>
                            </span>
                          ) : (
                            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmRevoke(key.id)}>Revoke</button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {revokedKeys.length > 0 && (
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  onClick={() => setShowRevoked(!showRevoked)}
                  style={{ fontSize: 12, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  {showRevoked ? "Hide revoked keys" : `Show revoked keys (${revokedKeys.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MCP Guide collapsible */}
      <div className="card" style={{ padding: 0 }}>
        <button
          onClick={() => setMcpExpanded(!mcpExpanded)}
          className="flex items-center justify-between w-full"
          style={{ padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>MCP Connection Guide</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Connect Kounta to Claude Code or Cursor</div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"
            style={{ transform: mcpExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {mcpExpanded && (
          <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
            <McpGuideContent />
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!createdKey) setShowCreateModal(false); }}
        >
          <div
            style={{
              width: 480,
              padding: 32,
              backgroundColor: "var(--surface-1)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.24)",
              transform: "translateY(-20px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!createdKey ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20 }}>Create API Key</h2>
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
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Key Created</h2>
                <p style={{ fontSize: 13, color: "#D97706", marginBottom: 20 }}>
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div
                  className="flex items-center justify-between"
                  style={{ borderRadius: 8, padding: 16, marginBottom: 20, gap: 12, backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <code className="font-mono" style={{ fontSize: 13, color: "var(--accent)", wordBreak: "break-all" }}>{createdKey}</code>
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


function McpGuideContent() {
  const [activeTool, setActiveTool] = useState<"claude-code" | "cursor">("claude-code");

  const configs = {
    "claude-code": {
      label: "Claude Code",
      file: ".claude/settings.json",
      config: `{
  "mcpServers": {
    "kounta": {
      "command": "npx",
      "args": ["@kounta/mcp@latest"],
      "env": {
        "KOUNTA_API_KEY": "YOUR_API_KEY_HERE",
        "KOUNTA_API_URL": "http://localhost:3100"
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
    "kounta": {
      "command": "npx",
      "args": ["@kounta/mcp@latest"],
      "env": {
        "KOUNTA_API_KEY": "YOUR_API_KEY_HERE",
        "KOUNTA_API_URL": "http://localhost:3100"
      }
    }
  }
}`,
    },
  };

  const cfg = configs[activeTool];

  return (
    <div style={{ paddingTop: 20 }}>
      <div className="flex" style={{ gap: 4, marginBottom: 20 }}>
        {(["claude-code", "cursor"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            style={{
              padding: "0 12px",
              height: 32,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTool === key ? "var(--surface-3)" : "transparent",
              color: activeTool === key ? "var(--accent)" : "var(--text-tertiary)",
              border: activeTool === key ? "1px solid var(--border-strong)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {configs[key].label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>
          <code className="font-mono" style={{ color: "var(--accent)" }}>{cfg.file}</code>
        </div>
        <CopyButton text={cfg.config} label="Copy" />
      </div>
      <div
        style={{
          borderRadius: 8,
          padding: 16,
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <pre className="font-mono overflow-x-auto" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {cfg.config}
        </pre>
      </div>
    </div>
  );
}
