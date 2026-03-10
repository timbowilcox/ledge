import { ledger, metrics, transactions } from "@/lib/mock-data";
import { formatCurrency, formatDate, formatNumber, formatPercent, truncateId } from "@/lib/format";
import Link from "next/link";

export default function OverviewPage() {
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3" style={{ marginBottom: 32 }}>
        <h1
          className="font-bold"
          style={{ fontSize: 24, color: "#f1f5f9", fontFamily: "var(--font-family-display)" }}
        >
          {ledger.name}
        </h1>
        <span className="badge badge-teal">{ledger.template}</span>
        <span className="text-sm" style={{ color: "#64748b" }}>
          {ledger.entity}
        </span>
      </div>

      {/* Metric cards */}
      <div
        className="grid grid-cols-4"
        style={{ gap: 20, marginBottom: 36 }}
      >
        <MetricCard
          label="Transactions"
          value={formatNumber(metrics.transactionCount)}
        />
        <MetricCard
          label="Accounts"
          value={formatNumber(metrics.accountCount)}
        />
        <MetricCard
          label="Ledger Value"
          value={formatCurrency(metrics.ledgerValue)}
          mono
        />
        <MetricCard
          label="Plan Usage"
          value={formatPercent(metrics.planUsage)}
          accent={metrics.planUsage > 80}
        />
      </div>

      {/* Recent transactions */}
      <div className="card" style={{ padding: 0 }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "20px 24px" }}
        >
          <span className="section-label">Recent Transactions</span>
          <Link href="/transactions" className="btn-ghost text-xs">
            View all \u2192
          </Link>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">ID</th>
              <th className="table-header">Date</th>
              <th className="table-header">Description</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((tx) => (
              <tr key={tx.id} className="table-row">
                <td className="table-cell font-mono text-xs" style={{ color: "#64748b" }}>
                  {truncateId(tx.id)}
                </td>
                <td className="table-cell text-sm">{formatDate(tx.date)}</td>
                <td className="table-cell text-sm text-slate-50">{tx.memo}</td>
                <td className="table-cell text-right font-mono text-sm text-slate-50">
                  {formatCurrency(tx.amount)}
                </td>
                <td className="table-cell text-right">
                  <span className={`badge ${tx.status === "posted" ? "badge-green" : "badge-red"}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="card">
      <div className="section-label" style={{ marginBottom: 10 }}>{label}</div>
      <div
        className={`font-bold ${mono ? "font-mono" : ""}`}
        style={{
          fontSize: 28,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: accent ? "#f59e0b" : "#f8fafc",
        }}
      >
        {value}
      </div>
    </div>
  );
}
