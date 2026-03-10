"use client";

import { useState } from "react";
import { apiKeys as initialKeys, type MockApiKey } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<readonly MockApiKey[]>(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    const prefix = "ledge_live_" + Math.random().toString(36).slice(2, 6);
    const fullKey = prefix + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const newKey: MockApiKey = {
      id: "k" + Date.now(),
      name: newKeyName.trim(),
      prefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      status: "active",
    };
    setKeys([newKey, ...keys]);
    setCreatedKey(fullKey);
    setNewKeyName("");
  };

  const handleRevoke = (keyId: string) => {
    setKeys(keys.map((k) => (k.id === keyId ? { ...k, status: "revoked" as const } : k)));
    setConfirmRevoke(null);
  };

  const envSnippet = createdKey
    ? `LEDGE_API_KEY=${createdKey}\nLEDGE_API_URL=http://localhost:3100`
    : "";

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <h1
          className="font-bold"
          style={{ fontSize: 24, color: "#f1f5f9", fontFamily: "var(--font-family-display)" }}
        >
          API Keys
        </h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
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
                <td className="table-cell text-sm text-slate-50 font-medium">{key.name}</td>
                <td className="table-cell font-mono text-xs" style={{ color: "#5eead4" }}>{key.prefix}...</td>
                <td className="table-cell text-sm">{formatDate(key.createdAt)}</td>
                <td className="table-cell text-sm">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</td>
                <td className="table-cell text-right">
                  <span className={`badge ${key.status === "active" ? "badge-green" : "badge-red"}`}>{key.status}</span>
                </td>
                <td className="table-cell text-right">
                  {key.status === "active" && (
                    <>
                      {confirmRevoke === key.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-xs" style={{ color: "#ef4444" }}>Confirm?</span>
                          <button className="text-xs font-medium" style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }} onClick={() => handleRevoke(key.id)}>Yes</button>
                          <button className="btn-ghost text-xs" onClick={() => setConfirmRevoke(null)}>No</button>
                        </span>
                      ) : (
                        <button className="btn-ghost text-xs" onClick={() => setConfirmRevoke(key.id)}>Revoke</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!createdKey) setShowCreateModal(false); }}
        >
          <div
            className="card"
            style={{ width: 500, padding: 36, transform: "translateY(-20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {!createdKey ? (
              <>
                <h2
                  className="font-bold text-slate-50"
                  style={{ fontSize: 20, marginBottom: 20, fontFamily: "var(--font-family-display)" }}
                >
                  Create API Key
                </h2>
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
                  <button className="btn-primary" onClick={handleCreate}>Create</button>
                </div>
              </>
            ) : (
              <>
                <h2
                  className="font-bold text-slate-50"
                  style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--font-family-display)" }}
                >
                  Key Created
                </h2>
                <p className="text-sm" style={{ color: "#f59e0b", marginBottom: 20 }}>
                  Copy this key now. You won&apos;t be able to see it again.
                </p>

                <div
                  className="flex items-center justify-between"
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 20,
                    gap: 12,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <code className="text-sm font-mono" style={{ color: "#5eead4", wordBreak: "break-all" }}>{createdKey}</code>
                  <CopyButton text={createdKey} />
                </div>

                <div className="section-label" style={{ marginBottom: 8 }}>.env snippet</div>
                <div
                  className="relative"
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 20,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <pre className="text-xs font-mono whitespace-pre" style={{ color: "#94a3b8" }}>{envSnippet}</pre>
                  <div className="absolute" style={{ top: 12, right: 12 }}>
                    <CopyButton text={envSnippet} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary" onClick={() => { setCreatedKey(null); setShowCreateModal(false); }}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
