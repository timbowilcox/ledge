"use client";

import { useState } from "react";

export function ImportCSV() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const fileContent = await file.text();

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }

      const result = await res.json();
      setImported(true);

      // Dispatch custom event so MatchReviewWrapper picks it up
      window.dispatchEvent(new CustomEvent("import-complete", { detail: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(13,148,136,0.06)",
        border: "1px solid rgba(13,148,136,0.12)",
      }}
    >
      <p className="text-sm font-medium text-slate-50 mb-1">
        Import Bank Statement
      </p>
      <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
        Upload a CSV file. The reconciliation engine will match rows against
        recorded expenses and show confidence scores.
      </p>

      <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
        {loading ? "Uploading..." : imported ? "Import Another" : "Choose CSV File"}
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
          disabled={loading}
        />
      </label>

      {imported && (
        <p className="text-xs mt-2" style={{ color: "#22c55e" }}>
          CSV imported! Review matches below.
        </p>
      )}

      {error && (
        <p className="text-xs mt-2 font-mono" style={{ color: "#ef4444" }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}
