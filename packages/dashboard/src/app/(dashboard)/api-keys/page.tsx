import { getSessionClient } from "@/lib/ledge";
import { ApiKeysView } from "./api-keys-view";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const { client, ledgerId } = await getSessionClient();
  const keys = await client.apiKeys.list(ledgerId);

  return <ApiKeysView initialKeys={[...keys]} />;
}
