"use client";

import { useState, useEffect } from "react";
import { MatchReview } from "./match-review";

export function MatchReviewWrapper() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Listen for import events from ImportCSV
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setBatchId(e.detail.batch.id);
      setResult(e.detail);
    };
    window.addEventListener("import-complete", handler as EventListener);
    return () => window.removeEventListener("import-complete", handler as EventListener);
  }, []);

  if (!result) return null;

  return (
    <MatchReview
      result={result}
      onConfirmed={() => {
        // Reload the page to refresh SSR data
        window.location.reload();
      }}
    />
  );
}
