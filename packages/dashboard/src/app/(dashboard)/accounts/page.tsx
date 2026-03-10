"use client";

import { useState } from "react";
import { accounts, type AccountType } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

const typeOrder: Record<AccountType, number> = {
  asset: 0, liability: 1, equity: 2, revenue: 3, expense: 4,
};

const typeLabels: Record<AccountType, string> = {
  asset: "Asset", liability: "Liability", equity: "Equity", revenue: "Revenue", expense: "Expense",
};

const typeBadge: Record<AccountType, string> = {
  asset: "badge-teal", liability: "badge-amber", equity: "badge-green", revenue: "badge-green", expense: "badge-red",
};

export default function AccountsPage() {
  const [expanded, setExpanded] = useState<Set<AccountType>>(
    new Set(["asset", "liability", "equity", "revenue", "expense"])
  );

  const grouped = accounts.reduce(
    (acc, account) => {
      if (!acc[account.type]) acc[account.type] = [];
      acc[account.type].push(account);
      return acc;
    },
    {} as Record<AccountType, typeof accounts[number][]>
  );

  const sortedTypes = (Object.keys(grouped) as AccountType[]).sort(
    (a, b) => typeOrder[a] - typeOrder[b]
  );

  const toggleGroup = (type: AccountType) => {
    const next = new Set(expanded);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setExpanded(next);
  };

  return (
    <div>
      <h1
        className="font-bold"
        style={{ fontSize: 24, color: "#f1f5f9", marginBottom: 28, fontFamily: "var(--font-family-display)" }}
      >
        Account Tree
      </h1>

      <div className="card" style={{ padding: 0 }}>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header" style={{ width: 120 }}>Code</th>
              <th className="table-header">Account Name</th>
              <th className="table-header" style={{ width: 100 }}>Type</th>
              <th className="table-header text-right" style={{ width: 160 }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {sortedTypes.map((type) => {
              const group = grouped[type];
              const isExpanded = expanded.has(type);
              const groupTotal = group.reduce((sum, a) => sum + a.balance, 0);
              return (
                <GroupRows
                  key={type}
                  type={type}
                  accounts={group}
                  isExpanded={isExpanded}
                  groupTotal={groupTotal}
                  onToggle={() => toggleGroup(type)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  type,
  accounts: groupAccounts,
  isExpanded,
  groupTotal,
  onToggle,
}: {
  type: AccountType;
  accounts: typeof accounts extends readonly (infer T)[] ? T[] : never;
  isExpanded: boolean;
  groupTotal: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer table-row"
        onClick={onToggle}
        style={{ backgroundColor: "rgba(255,255,255,0.01)" }}
      >
        <td className="table-cell" colSpan={2}>
          <div className="flex items-center gap-2.5">
            <svg
              width="14" height="14" viewBox="0 0 14 14"
              fill="none" stroke="#64748b" strokeWidth="1.5"
              style={{
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <path d="M5 3l4 4-4 4" />
            </svg>
            <span className="text-sm font-semibold text-slate-50">
              {typeLabels[type]}s
            </span>
            <span className="text-xs" style={{ color: "#475569" }}>
              ({groupAccounts.length})
            </span>
          </div>
        </td>
        <td className="table-cell">
          <span className={`badge ${typeBadge[type]}`}>{typeLabels[type]}</span>
        </td>
        <td
          className="table-cell text-right font-mono text-sm font-medium"
          style={{ color: groupTotal < 0 ? "#ef4444" : "#f8fafc" }}
        >
          {formatCurrency(Math.abs(groupTotal))}
        </td>
      </tr>

      {isExpanded &&
        groupAccounts.map((account) => (
          <tr key={account.id} className="table-row">
            <td className="table-cell" style={{ paddingLeft: 44 }}>
              <code className="text-xs font-mono" style={{ color: "#5eead4" }}>
                {account.code}
              </code>
            </td>
            <td className="table-cell text-sm text-slate-50">{account.name}</td>
            <td className="table-cell">
              <span className={`badge ${typeBadge[type]}`}>{typeLabels[type]}</span>
            </td>
            <td
              className="table-cell text-right font-mono text-sm"
              style={{ color: account.balance < 0 ? "#ef4444" : "#f8fafc" }}
            >
              {formatCurrency(Math.abs(account.balance))}
            </td>
          </tr>
        ))}
    </>
  );
}
