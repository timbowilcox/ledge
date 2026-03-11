import { getLedgeClient } from "@/lib/ledge";
import { TemplatesGrid } from "./templates-grid";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const client = getLedgeClient();
  const templates = await client.templates.list();

  return <TemplatesGrid templates={templates} />;
}
