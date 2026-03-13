"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import {
  fetchIncomeStatement,
  fetchBalanceSheet,
  fetchCashFlow,
} from "@/lib/actions";
import type { StatementResponse } from "@ledge/sdk";
import { ContextualPrompt } from "@/components/contextual-prompt";

type Tab = "pnl" | "balance_sheet" | "cash_flow";

const tabs: { key: Tab; label: string }[] = [
  { key: "pnl", label: "Profit & Loss" },
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0A0A0A" }}>
          Statements
        </h1>
        <ContextualPrompt placeholder="Generate or ask about statements..." />
      </div>

      {/* Underline tab selector */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #E5E5E5",
          marginBottom: 24,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#0066FF" : "#999999",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #0066FF" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div>
          <label className="section-label block" style={{ marginBottom: 4 }}>Start</label>
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="section-label block" style={{ marginBottom: 4 }}>End</label>
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button className="btn-primary" onClick={refresh} disabled={isPending}>
            {isPending ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Plain-language summary */}
      <div
        style={{
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E5E5",
        }}
      >
        <p style={{ fontSize: 13, color: "#666666", lineHeight: 1.7 }}>
          {statement.plainLanguageSummary}
        </p>
      </div>

      {/* Statement table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>
            {formatStatementTitle(statement.statementType)}
          </h2>
          <span style={{ fontSize: 12, color: "#999999" }}>
            {activeTab === "balance_sheet"
              ? "As of " + endDate
              : startDate + " to " + endDate}
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header" style={{ position: "sticky", top: 0, zIndex: 1 }}>Account</th>
              <th className="table-header text-right" style={{ width: 160, position: "sticky", top: 0, zIndex: 1 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.sections.map((section) => (
              <SectionRows key={section.name} section={section} />
            ))}

            {Object.entries(statement.totals).map(([key, value]) => {
              const isGrand = key === "netIncome" || key === "netChange" || key === "grossProfit";
              return (
                <tr key={key} className={isGrand ? "grand-total-row" : ""} style={!isGrand ? { backgroundColor: "#FAFAFA" } : undefined}>
                  <td
                    style={{
                      padding: "12px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderTop: "1px solid #E5E5E5",
                      color: isGrand ? "white" : "#0A0A0A",
                    }}
                  >
                    {formatTotalLabel(key)}
                  </td>
                  <td
                    className="font-mono text-right"
                    style={{
                      padding: "12px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderTop: "1px solid #E5E5E5",
                      color: isGrand ? "white" : "#0A0A0A",
                    }}
                  >
                    {key === "debtToEquity"
                      ? (value / 100).toFixed(2)
                      : formatCurrency(Math.abs(value))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({ section }: { section: StatementResponse["sections"][number] }) {
  return (
    <>
      {/* Section header */}
      <tr>
        <td
          colSpan={2}
          style={{
            padding: "16px 20px 8px",
            fontSize: 12,
            fontWeight: 500,
            color: "#999999",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {section.name}
        </td>
      </tr>

      {/* Line items */}
      {section.lines.map((line) => (
        <tr
          key={line.accountCode + line.accountName}
          className="table-row"
        >
          <td className="table-cell" style={{ paddingLeft: 32, fontSize: 13 }}>
            {line.accountCode && (
              <code className="font-mono" style={{ fontSize: 12, color: "#666666", marginRight: 8 }}>
                {line.accountCode}
              </code>
            )}
            <span style={{ color: "#666666" }}>{line.accountName}</span>
          </td>
          <td
            className="table-cell text-right font-mono"
            style={{
              fontSize: 13,
              color: line.currentPeriod < 0 ? "#DC2626" : "#0A0A0A",
            }}
          >
            {line.currentPeriod < 0 ? "(" : ""}
            {formatCurrency(Math.abs(line.currentPeriod))}
            {line.currentPeriod < 0 ? ")" : ""}
          </td>
        </tr>
      ))}

      {/* Section total */}
      <tr style={{ backgroundColor: "#FAFAFA" }}>
        <td
          style={{
            paddingLeft: 32,
            padding: "10px 20px 10px 32px",
            borderTop: "1px solid #E5E5E5",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Total {section.name}
        </td>
        <td
          className="text-right font-mono"
          style={{
            padding: "10px 20px",
            borderTop: "1px solid #E5E5E5",
            fontSize: 13,
            fontWeight: 600,
            color: section.total < 0 ? "#DC2626" : "#0A0A0A",
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
    income_statement: "Profit & Loss Statement",
    pnl: "Profit & Loss Statement",
    balance_sheet: "Balance Sheet",
    cash_flow: "Cash Flow Statement",
  };
  return titles[type] ?? type;
}

function formatTotalLabel(key: string): string {
  const labels: Record<string, string> = {
    totalRevenue: "Total Revenue",
    totalCogs: "Cost of Goods Sold",
    grossProfit: "Gross Profit",
    totalOperatingExpenses: "Total Operating Expenses",
    operatingIncome: "Operating Income",
    netIncome: "Net Income",
    totalAssets: "Total Assets",
    totalLiabilities: "Total Liabilities",
    totalEquity: "Total Equity",
    totalLiabilitiesAndEquity: "Total Liabilities & Equity",
    debtToEquity: "Debt-to-Equity Ratio",
    netChange: "Net Change in Cash",
    totalOperating: "Cash from Operations",
    totalInvesting: "Cash from Investing",
    totalFinancing: "Cash from Financing",
  };
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}
