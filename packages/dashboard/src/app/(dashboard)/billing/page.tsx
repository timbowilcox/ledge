import { fetchBillingStatus } from "@/lib/actions";
import { BillingView } from "./billing-view";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const billing = await fetchBillingStatus();
  return <BillingView billing={billing} />;
}
