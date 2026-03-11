import { getLedgeClient, getLedgerId } from "@/lib/ledge";
import { StatementsView } from "./statements-view";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();

  // Default date range: start of year to today
  const now = new Date();
  const startDate = now.getFullYear() + "-01-01";
  const endDate = now.toISOString().split("T")[0];

  const [pnl, bs, cf] = await Promise.all([
    client.reports.incomeStatement(ledgerId, startDate, endDate),
    client.reports.balanceSheet(ledgerId, endDate),
    client.reports.cashFlow(ledgerId, startDate, endDate),
  ]);

  return (
    <StatementsView
      initialPnl={pnl}
      initialBalanceSheet={bs}
      initialCashFlow={cf}
      defaultStart={startDate}
      defaultEnd={endDate}
    />
  );
}
