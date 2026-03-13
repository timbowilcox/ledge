import { getSessionClient } from "@/lib/ledge";
import type { ApiKeySafe } from "@ledge/sdk";
import { ApiKeysView } from "./api-keys-view";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  let keys: ApiKeySafe[] = [];
  try {
    const { client, ledgerId } = await getSessionClient();
    keys = [...(await client.apiKeys.list(ledgerId))];
  } catch {
    // Session or API error — render empty state
  }

  return <ApiKeysView initialKeys={keys} />;
}
