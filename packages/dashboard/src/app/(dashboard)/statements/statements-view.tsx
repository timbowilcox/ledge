"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import {
  fetchIncomeStatement,
  fetchBalanceSheet,
  fetchCashFlow,
} from "@/lib/actions";
import type { StatementResponse } from "@ledge/sdk";

type Tab = "pnl" | "balance_sheet" | "cash_flow";

const tabs: { key: Tab; label: string }[] = [
  { key: "pnl", label: "Income Statement" },
  { key: "balance_sheet", label: "Balance Sheet" },
  { key: "cash_flow", label: "Cash Flow" },
];

interface Props {
  initialPnl: StatementResponse;
  initialBalanceSheet: StatementResponse;
  initialCashFlow: StatementResponse;
  defaultStart: string;
  defaultEnd: string;
}

export function StatementsView({
  initialPnl,
  initialBalanceSheet,
  initialCashFlow,
  defaultStart,
  defaultEnd,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("pnl");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [statements, setStatements] = useState<Record<Tab, StatementResponse>>({
    pnl: initialPnl,
    balance_sheet: initialBalanceSheet,
    cash_flow: initialCashFlow,
  });
  const [isPending, startTransition] = useTransition();

  const statement = statements[activeTab];

  const refresh = () => {
    startTransition(async () => {
      const [pnl, bs, cf] = await Promise.all([
        fetchIncomeStatement(startDate, endDate),
        fetchBalanceSheet(endDate),
        fetchCashFlow(startDate, endDate),
      ]);
      setStatements({ pnl, balance_sheet: bs, cash_flow: cf });
    });
  };

  return (
    <div>
      <h1
        className="font-bold"
        style={{ fontSize: 24, color: "#f1f5f9", marginBottom: 28, fontFamily: "var(--font-family-display)" }}
      >
        Statements
      </h1>

      {/* Tab selector */}
      <div className="flex items-center" style={{ gap: 6, marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              backgroundColor: activeTab === tab.key ? "rgba(13,148,136,0.1)" : "transparent",
              color: activeTab === tab.key ? "#5eead4" : "#64748b",
              border: activeTab === tab.key ? "1px solid rgba(13,148,136,0.2)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center" style={{ gap: 16, marginBottom: 24 }}>
        <div>
          <label className="section-label block" style={{ marginBottom: 8 }}>Start</label>
          <input
            type="date"
            className="input text-sm"
            style={{ width: 170 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="section-label block" style={{ marginBottom: 8 }}>End</label>
          <input
            type="date"
            className="input text-sm"
            style={{ width: 170 }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button className="btn-primary text-sm" onClick={refresh} disabled={isPending}>
            {isPending ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Plain-language summary */}
      <div
        style={{
          borderRadius: 18,
          padding: 24,
          marginBottom: 24,
          backgroundColor: "rgba(13,148,136,0.05)",
          border: "1px solid rgba(13,148,136,0.1)",
        }}
      >
        <p className="text-sm" style={{ color: "#94a3b8", lineHeight: 1.7 }}>
          {statement.plainLanguageSummary}
        </p>
      </div>

      {/* Statement table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px" }}>
          <h2
            className="font-bold text-slate-50"
            style={{ fontSize: 18, fontFamily: "var(--font-family-display)" }}
          >
            {formatStatementTitle(statement.statementType)}
          </h2>
          <span className="text-xs" style={{ color: "#64748b" }}>
            {activeTab === "balance_sheet"
              ? "As of " + endDate
              : startDate + " to " + endDate}
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Account</th>
              <th className="table-header text-right" style={{ width: 160 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.sections.map((section) => (
              <SectionRows key={section.name} section={section} />
            ))}

            {Object.entries(statement.totals).map(([key, value]) => (
              <tr key={key}>
                <td
                  className="text-sm font-bold text-slate-50"
                  style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {formatTotalLabel(key)}
                </td>
                <td
                  className="text-right font-mono text-sm font-bold"
                  style={{
                    padding: "14px 20px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    color: key === "netIncome" || key === "netChange"
                      ? value >= 0 ? "#5eead4" : "#ef4444"
                      : "#f8fafc",
                    backgroundColor: (key === "netIncome" || key === "netChange" || key === "totalAssets")
                      ? "rgba(13,148,136,0.04)"
                      : undefined,
                  }}
                >
                  {key === "debtToEquity"
                    ? (value / 100).toFixed(2)
                    : formatCurrency(Math.abs(value))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({ section }: { section: StatementResponse["sections"][number] }) {
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className="text-sm font-bold"
          style={{ padding: "20px 20px 10px", color: "#5eead4" }}
        >
          {section.name}
        </td>
      </tr>

      {section.lines.map((line) => (
        <tr key={line.accountCode + line.accountName} className="table-row">
          <td className="table-cell text-sm" style={{ paddingLeft: 36 }}>
            {line.accountCode && (
              <code className="font-mono text-xs" style={{ color: "#5eead4", marginRight: 8 }}>
                {line.accountCode}
              </code>
            )}
            <span style={{ color: "#94a3b8" }}>{line.accountName}</span>
          </td>
          <td
            className="table-cell text-right font-mono text-sm"
            style={{ color: line.currentPeriod < 0 ? "#ef4444" : "#f8fafc" }}
          >
            {line.currentPeriod < 0 ? "(" : ""}
            {formatCurrency(Math.abs(line.currentPeriod))}
            {line.currentPeriod < 0 ? ")" : ""}
          </td>
        </tr>
      ))}

      <tr>
        <td
          className="text-sm font-medium text-slate-50"
          style={{
            paddingLeft: 36,
            padding: "10px 20px 10px 36px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          Total {section.name}
        </td>
        <td
          className="text-right font-mono text-sm font-medium"
          style={{
            padding: "10px 20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            color: section.total < 0 ? "#ef4444" : "#f8fafc",
          }}
        >
          {section.total < 0 ? "(" : ""}
          {formatCurrency(Math.abs(section.total))}
          {section.total < 0 ? ")" : ""}
        </td>
      </tr>
    </>
  );
}

function formatStatementTitle(type: string): string {
  const titles: Record<string, string> = {
    income_statement: "Income Statement",
    balance_sheet: "Balance Sheet",
    cash_flow: "Cash Flow Statement",
  };
  return titles[type] ?? type;
}

function formatTotalLabel(key: string): string {
  const labels: Record<string, string> = {
    grossProfit: "Gross Profit",
    netIncome: "Net Income",
    totalAssets: "Total Assets",
    totalLiabilitiesAndEquity: "Total Liabilities & Equity",
    debtToEquity: "Debt-to-Equity Ratio",
    netChange: "Net Change in Cash",
  };
  return labels[key] ?? key;
}
