import { ledge, ledgerId } from "@/lib/ledge";
import { RecordExpense } from "@/components/record-expense";
import { ImportCSV } from "@/components/import-csv";
import { RecentTransactions } from "@/components/recent-transactions";
import { StatementTable } from "@/components/statement-table";
import { MatchReviewWrapper } from "@/components/match-review-wrapper";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [accounts, txnResult, pnl, balanceSheet] = await Promise.all([
    ledge.accounts.list(ledgerId),
    ledge.transactions.list(ledgerId, { limit: 20 }),
    ledge.reports.incomeStatement(ledgerId, "2026-01-01", "2026-12-31"),
    ledge.reports.balanceSheet(ledgerId, "2026-12-31"),
  ]);

  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
  const cashAccount = accounts.find((a) => a.code === "1000");
  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="section-label">Total Expenses</p>
          <p className="text-2xl font-bold mt-1 font-mono" style={{ color: "#ef4444" }}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalExpenses / 100)}
          </p>
        </div>
        <div className="stat-card">
          <p className="section-label">Total Revenue</p>
          <p className="text-2xl font-bold mt-1 font-mono" style={{ color: "#22c55e" }}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalRevenue / 100)}
          </p>
        </div>
        <div className="stat-card">
          <p className="section-label">Cash Balance</p>
          <p className="text-2xl font-bold mt-1 font-mono" style={{ color: "#5eead4" }}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cashAccount?.balance ?? 0) / 100)}
          </p>
        </div>
      </div>

      {/* Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecordExpense />
        <ImportCSV />
      </div>

      {/* Match review (client-side wrapper) */}
      <MatchReviewWrapper />

      {/* Statements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatementTable statement={pnl} title="Income Statement" />
        <StatementTable statement={balanceSheet} title="Balance Sheet" />
      </div>

      {/* Recent transactions */}
      <RecentTransactions transactions={txnResult.data} />
    </div>
  );
}
