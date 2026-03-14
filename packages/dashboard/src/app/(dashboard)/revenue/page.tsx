import {
  fetchRevenueMetrics,
  fetchMrrHistory,
  fetchRevenueSchedules,
  fetchAccounts,
} from "@/lib/actions";
import { RevenueView } from "./revenue-view";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [metrics, mrrHistory, schedules, accounts] = await Promise.allSettled([
    fetchRevenueMetrics(),
    fetchMrrHistory(12),
    fetchRevenueSchedules(),
    fetchAccounts(),
  ]);

  return (
    <RevenueView
      initialMetrics={
        metrics.status === "fulfilled"
          ? metrics.value
          : { mrr: 0, arr: 0, deferredRevenueBalance: 0, recognisedThisMonth: 0, recognisedThisYear: 0, activeSchedules: 0 }
      }
      initialMrrHistory={mrrHistory.status === "fulfilled" ? mrrHistory.value : []}
      initialSchedules={schedules.status === "fulfilled" ? schedules.value.data : []}
      accounts={accounts.status === "fulfilled" ? accounts.value : []}
    />
  );
}
