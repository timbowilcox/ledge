import { getLedgeClient, getLedgerId } from "@/lib/ledge";
import { ApiKeysView } from "./api-keys-view";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const client = getLedgeClient();
  const ledgerId = getLedgerId();
  const keys = await client.apiKeys.list(ledgerId);

  return <ApiKeysView initialKeys={[...keys]} />;
}
