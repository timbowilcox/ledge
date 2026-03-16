import { auth } from "@/lib/auth";
import { fetchUserLedgers, getActiveLedgerId, fetchCurrentTier } from "@/lib/actions";
import { DashboardHeaderClient } from "./dashboard-header-client";

export async function DashboardHeader() {
  let ledgers: Awaited<ReturnType<typeof fetchUserLedgers>> = [];
  let activeLedgerId = "";
  let currentTier = "free";

  try {
    [ledgers, activeLedgerId, currentTier] = await Promise.all([
      fetchUserLedgers(),
      getActiveLedgerId(),
      fetchCurrentTier(),
    ]);
  } catch {
    // If not authenticated, render nothing
    return null;
  }

  if (!ledgers.length) return null;

  return (
    <DashboardHeaderClient
      ledgers={ledgers}
      activeLedgerId={activeLedgerId}
      currentTier={currentTier}
    />
  );
}
