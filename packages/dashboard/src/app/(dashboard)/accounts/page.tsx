import { getSessionClient } from "@/lib/ledge";
import type { AccountWithBalance } from "@ledge/sdk";
import { AccountsView } from "./accounts-view";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  let accounts: AccountWithBalance[] = [];
  try {
    const { client, ledgerId } = await getSessionClient();
    accounts = await client.accounts.list(ledgerId);
  } catch {
    // Session or API error — render empty state
  }

  return <AccountsView accounts={accounts} />;
}
