import { getSessionClient } from "@/lib/ledge";
import { BankFeedsView } from "./bank-feeds-view";

export const dynamic = "force-dynamic";

export default async function BankFeedsPage() {
  let connections: unknown[] = [];
  let error: string | null = null;

  try {
    const { client, ledgerId } = await getSessionClient();
    connections = await client.bankFeeds.listConnections(ledgerId);
  } catch (e: unknown) {
    // Bank feeds may not be configured or user may be on free plan
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("403") || msg.includes("Builder plan")) {
      error = "upgrade";
    } else if (msg.includes("503") || msg.includes("not configured")) {
      error = "not-configured";
    } else {
      // Swallow other errors — show empty state
      error = null;
    }
  }

  return <BankFeedsView connections={connections} error={error} />;
}
