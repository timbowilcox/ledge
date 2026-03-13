import { getSessionClient } from "@/lib/ledge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { auth } from "@/lib/auth";
import Link from "next/link";
import type { TransactionWithLines, AccountWithBalance } from "@ledge/sdk";
import { ContextualPrompt } from "@/components/contextual-prompt";

export const dynamic = "force-dynamic";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const { client, ledgerId } = await getSessionClient();
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  const [ledger, accountsList, txResult] = await Promise.all([
    client.ledgers.get(ledgerId),
    client.accounts.list(ledgerId),
    client.transactions.list(ledgerId, { limit: 5 }),
  ]);

  const accountCount = accountsList.length;
  const totalAssets = accountsList
    .filter((a: AccountWithBalance) => a.type === "asset")
    .reduce((sum: number, a: AccountWithBalance) => sum + a.balance, 0);
  const totalRevenue = accountsList
    .filter((a: AccountWithBalance) => a.type === "revenue")
    .reduce((sum: number, a: AccountWithBalance) => sum + Math.abs(a.balance), 0);
  const totalExpenses = accountsList
    .filter((a: AccountWithBalance) => a.type === "expense")
    .reduce((sum: number, a: AccountWithBalance) => sum + Math.abs(a.balance), 0);

  const recentTransactions = txResult.data;

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1
            className="font-semibold"
            style={{ fontSize: 28, color: "#0A0A0A", fontFamily: "var(--font-heading)", marginBottom: 8 }}
          >
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm" style={{ color: "rgba(0,0,0,0.45)" }}>
            {ledger.name} &middot; {ledger.currency} &middot; {ledger.accountingBasis}
          </p>
        </div>
        <ContextualPrompt placeholder="Ask about your financial overview..." />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4" style={{ gap: 20, marginBottom: 32 }}>
        <MetricCard label="Accounts" value={formatNumber(accountCount)} variant="default" />
        <MetricCard label="Total Assets" value={formatCurrency(totalAssets)} mono variant="blue" />
        <MetricCard label="Revenue" value={formatCurrency(totalRevenue)} mono variant="green" />
        <MetricCard label="Expenses" value={formatCurrency(totalExpenses)} mono variant="default" />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Quick Actions</div>
        <div className="flex" style={{ gap: 12 }}>
          <QuickAction
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>}
            label="Post transaction"
            href="/transactions"
          />
          <QuickAction
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"><path d="M2 13V5M5.5 13V7.5M9 13V3M12.5 13V9" /></svg>}
            label="Generate statement"
            href="/statements"
          />
          <QuickAction
            icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"><path d="M2 3h12M3 3v10M13 3v10M2 13h12M2 6.5h12" /></svg>}
            label="Connect bank account"
            href="/bank-feeds"
          />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card" style={{ padding: 0 }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: "20px 24px" }}
        >
          <span className="section-label">Recent Transactions</span>
          <Link href="/transactions" className="btn-ghost text-xs">
            View all &rarr;
          </Link>
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header" style={{ position: "sticky", top: 0, backgroundColor: "#F7F7F6", zIndex: 1 }}>Date</th>
              <th className="table-header" style={{ position: "sticky", top: 0, backgroundColor: "#F7F7F6", zIndex: 1 }}>Description</th>
              <th className="table-header text-right" style={{ position: "sticky", top: 0, backgroundColor: "#F7F7F6", zIndex: 1 }}>Amount</th>
              <th className="table-header text-right" style={{ position: "sticky", top: 0, backgroundColor: "#F7F7F6", zIndex: 1 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((tx: TransactionWithLines) => {
              const totalDebit = tx.lines
                .filter((l) => l.direction === "debit")
                .reduce((sum, l) => sum + l.amount, 0);
              return (
                <tr key={tx.id} className="table-row">
                  <td className="table-cell font-mono text-sm" style={{ color: "#64748b" }}>{formatDate(tx.date)}</td>
                  <td className="table-cell text-sm" style={{ color: "#0f172a", fontWeight: 500 }}>{tx.memo}</td>
                  <td className="table-cell text-right font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="table-cell text-right">
                    <span className={"badge " + (tx.status === "posted" ? "badge-green" : "badge-red")}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {recentTransactions.length === 0 && (
              <tr>
                <td colSpan={4} className="table-cell text-center" style={{ padding: 48 }}>
                  <EmptyState
                    icon={<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round"><path d="M6 11h28M6 20h28M6 29h18" /></svg>}
                    title="No transactions yet"
                    description="Post your first transaction to see it here."
                    actionLabel="Post transaction"
                    actionHref="/transactions"
                  />
                </td>
              </tr>
            )}
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
  variant = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  variant?: "default" | "blue" | "green";
}) {
  const bgColor = variant === "blue" ? "#eff6ff" : variant === "green" ? "#ecfdf5" : "#f8fafc";
  const valueColor = variant === "blue" ? "#2563eb" : variant === "green" ? "#059669" : "#0f172a";
  const sparkColor = variant === "blue" ? "#3b82f6" : variant === "green" ? "#10b981" : "#94a3b8";
  return (
    <div className="stat-card" style={{ backgroundColor: bgColor }}>
      <div className="stat-card-label">{label}</div>
      <div
        className={"stat-card-value " + (mono ? "font-mono" : "")}
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="stat-sparkline" style={{ backgroundColor: sparkColor, width: "60%" }} />
    </div>
  );
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 quick-action"
      style={{
        padding: "12px 20px",
        borderRadius: 16,
        border: "none",
        backgroundColor: "#f8fafc",
        fontSize: 13,
        fontWeight: 500,
        color: "#0A0A0A",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(59,130,246,0.08)" }}>
        {icon}
      </div>
      {label}
    </Link>
  );
}

function EmptyState({ icon, title, description, actionLabel, actionHref }: { icon: React.ReactNode; title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ marginBottom: 8 }}>{icon}</div>
      <div className="text-sm font-medium" style={{ color: "#0A0A0A" }}>{title}</div>
      <div className="text-xs" style={{ color: "rgba(0,0,0,0.36)", maxWidth: 280 }}>{description}</div>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary text-xs" style={{ marginTop: 12, padding: "8px 16px" }}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
