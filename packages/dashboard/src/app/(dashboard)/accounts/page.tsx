import { getSessionClient } from "@/lib/ledge";
import { AccountsView } from "./accounts-view";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { client, ledgerId } = await getSessionClient();
  const accounts = await client.accounts.list(ledgerId);

  return <AccountsView accounts={accounts} />;
}
