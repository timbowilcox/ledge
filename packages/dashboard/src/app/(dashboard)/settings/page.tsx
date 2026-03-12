import { getSessionClient } from "@/lib/ledge";
import { fetchBillingStatus, fetchApiKeys } from "@/lib/actions";
import { SettingsView } from "./settings-view";
import type { ApiKeySafe } from "@ledge/sdk";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { client, ledgerId } = await getSessionClient();

  const [ledger, billing, apiKeys, currencies, exchangeRates] = await Promise.all([
    client.ledgers.get(ledgerId),
    fetchBillingStatus(),
    fetchApiKeys(),
    client.currencies.list(ledgerId).catch(() => []),
    client.currencies.listRates(ledgerId).catch(() => []),
  ]);

  return (
    <SettingsView
      ledger={ledger}
      billing={billing}
      initialKeys={[...apiKeys] as ApiKeySafe[]}
      currencies={currencies as any[]}
      exchangeRates={exchangeRates as any[]}
    />
  );
}
