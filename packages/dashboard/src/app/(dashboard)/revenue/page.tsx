import {
  fetchRevenueMetrics,
  fetchMrrHistory,
  fetchRevenueSchedules,
  fetchAccounts,
  fetchBillingStatus,
} from "@/lib/actions";
import { RevenueView } from "./revenue-view";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const billing = await fetchBillingStatus().catch(() => ({ plan: "free" }));
  const tier = billing.plan;

  if (tier !== "pro" && tier !== "platform") {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Revenue Recognition</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            Deferred revenue, MRR tracking, and recognition schedules
          </p>
        </div>
        <div style={{ maxWidth: 480, margin: "40px auto" }}>
          <UpgradePrompt
            feature="revenueRecognition"
            message="Revenue recognition is available on Pro ($49/month). Track MRR, manage deferred revenue, and automate recognition schedules."
            currentTier={tier}
            requiredTier="pro"
          />
        </div>
      </div>
    );
  }

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
