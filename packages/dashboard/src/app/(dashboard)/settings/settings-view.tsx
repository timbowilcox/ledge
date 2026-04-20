"use client";

// ---------------------------------------------------------------------------
// Settings — orchestrator that switches between tabs.
// Each tab's implementation lives in tabs/<name>-tab.tsx.
// Cross-tab helpers live in _shared.tsx.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BillingStatus, TierUsage, ClosedPeriodSummary, JurisdictionOption, JurisdictionSettings } from "@/lib/actions";
import type { ApiKeySafe, AccountWithBalance, CurrencySetting, ExchangeRate } from "@kounta/sdk";
import { AccountsView } from "@/app/(dashboard)/accounts/accounts-view";
import { GeneralTab } from "./tabs/general-tab";
import { CurrenciesTab } from "./tabs/currencies-tab";
import { ApiKeysTab } from "./tabs/api-keys-tab";
import { BillingTab } from "./tabs/billing-tab";
import { EmailTab } from "./tabs/email-tab";
import { RecurringTab } from "./tabs/recurring-tab";
import { ConnectionsTab } from "./tabs/connections-tab";

type SettingsTab = "general" | "accounts" | "currencies" | "api-keys" | "billing" | "email" | "recurring" | "connections";

interface Props {
  ledger: { name: string; currency: string; accountingBasis: string; templateId: string | null; createdAt: string };
  ledgerId?: string;
  billing: BillingStatus;
  tierUsage: TierUsage;
  initialKeys: ApiKeySafe[];
  currencies: CurrencySetting[];
  exchangeRates: ExchangeRate[];
  fiscalYearStart: number;
  closedThrough: string | null;
  closedPeriods: ClosedPeriodSummary[];
  accounts: AccountWithBalance[];
  jurisdictions: JurisdictionOption[];
  jurisdictionSettings: JurisdictionSettings;
  totalLedgerCount?: number;
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "accounts", label: "Accounts" },
  { key: "currencies", label: "Currencies" },
  { key: "recurring", label: "Recurring" },
  { key: "connections", label: "Connections" },
  { key: "api-keys", label: "API Keys" },
  { key: "billing", label: "Subscription" },
  { key: "email", label: "Email" },
];

export function SettingsView({ ledger, ledgerId, billing, tierUsage, initialKeys, currencies, exchangeRates, fiscalYearStart, closedThrough, closedPeriods, accounts, jurisdictions, jurisdictionSettings, totalLedgerCount = 1 }: Props) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "general";
  const [activeTab, setActiveTab] = useState<SettingsTab>(TABS.some(t => t.key === initialTab) ? initialTab : "general");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>Settings</h1>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
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
                padding: "8px 16px", paddingBottom: 10, fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                background: "none", border: "none",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", transition: "all 150ms ease", marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "general" && <GeneralTab ledger={ledger} ledgerId={ledgerId} fiscalYearStart={fiscalYearStart} closedThrough={closedThrough} closedPeriods={closedPeriods} jurisdictions={jurisdictions} jurisdictionSettings={jurisdictionSettings} totalLedgerCount={totalLedgerCount} />}
      {activeTab === "accounts" && <AccountsView accounts={accounts} />}
      {activeTab === "currencies" && <CurrenciesTab currencies={currencies} exchangeRates={exchangeRates} />}
      {activeTab === "api-keys" && <ApiKeysTab initialKeys={initialKeys} currentTier={tierUsage.tier} />}
      {activeTab === "billing" && <BillingTab billing={billing} tierUsage={tierUsage} />}
      {activeTab === "email" && <EmailTab />}
      {activeTab === "recurring" && <RecurringTab />}
      {activeTab === "connections" && <ConnectionsTab />}
    </div>
  );
}
