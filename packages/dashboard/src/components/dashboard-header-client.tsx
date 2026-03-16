"use client";

import type { LedgerSummary } from "@/lib/actions";
import { LedgerSwitcher } from "./ledger-switcher";

interface Props {
  ledgers: LedgerSummary[];
  activeLedgerId: string;
  currentTier: string;
}

export function DashboardHeaderClient({ ledgers, activeLedgerId, currentTier }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        marginBottom: "1.5rem",
        minHeight: 36,
      }}
    >
      <LedgerSwitcher
        ledgers={ledgers}
        activeLedgerId={activeLedgerId}
        currentTier={currentTier}
      />
    </div>
  );
}
