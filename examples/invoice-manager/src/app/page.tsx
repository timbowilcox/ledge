import { ledge, ledgerId } from "@/lib/ledge";
import { formatCurrency } from "@/lib/format";
import { StatementTable } from "@/components/statement-table";
import { AccountBalances } from "@/components/account-balances";
import { RecentTransactions } from "@/components/recent-transactions";
import { CreateInvoice } from "@/components/create-invoice";
import { MarkPaid } from "@/components/mark-paid";
import { RecordExpense } from "@/components/record-expense";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfYear = `${today.slice(0, 4)}-01-01`;

  const [pnl, balanceSheet, accounts, txns] = await Promise.all([
    ledge.reports.incomeStatement(ledgerId, startOfYear, today),
    ledge.reports.balanceSheet(ledgerId, today),
    ledge.accounts.list(ledgerId),
    ledge.transactions.list(ledgerId, { limit: 20 }),
  ]);

  // KPI cards
  const revenue = pnl.totals.totalRevenue ?? 0;
  const expenses = pnl.totals.totalExpenses ?? 0;
  const netIncome = pnl.totals.netIncome ?? 0;
  const cashAccount = accounts.find((a) => a.code === "1000");
  const arAccount = accounts.find((a) => a.code === "1100");

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard label="Revenue" value={formatCurrency(revenue)} />
        <KPICard label="Expenses" value={formatCurrency(expenses)} />
        <KPICard
          label="Net Income"
          value={formatCurrency(Math.abs(netIncome))}
          positive={netIncome >= 0}
        />
        <KPICard label="Cash" value={formatCurrency(cashAccount?.balance ?? 0)} />
        <KPICard label="Receivables" value={formatCurrency(arAccount?.balance ?? 0)} />
      </div>

      {/* Action Forms */}
      <div>
        <p className="section-label mb-3">Actions</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CreateInvoice />
          <MarkPaid />
          <RecordExpense />
        </div>
      </div>

      {/* Statements */}
      <div>
        <p className="section-label mb-3">Financial Statements</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatementTable
            title="Income Statement"
            subtitle={`${startOfYear} — ${today}`}
            statement={pnl}
          />
          <StatementTable
            title="Balance Sheet"
            subtitle={`As of ${today}`}
            statement={balanceSheet}
          />
        </div>
      </div>

      {/* Account Balances */}
      <div>
        <p className="section-label mb-3">Chart of Accounts</p>
        <AccountBalances accounts={accounts} />
      </div>

      {/* Recent Transactions */}
      <div>
        <p className="section-label mb-3">Journal</p>
        <RecentTransactions transactions={txns.data} />
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <p className="text-xs mb-1" style={{ color: "#64748b" }}>
        {label}
      </p>
      <p
        className="text-xl font-bold font-mono"
        style={{
          color:
            positive === true
              ? "#5eead4"
              : positive === false
                ? "#ef4444"
                : "#f8fafc",
        }}
      >
        {value}
      </p>
    </div>
  );
}
