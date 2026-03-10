// ---------------------------------------------------------------------------
// MCP Server factory — assembles the McpServer with all tools, resources,
// and prompts. Transport-agnostic; the caller connects the transport.
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LedgerEngine, Database } from "@ledge/core";

import { registerSetupTools } from "./tools/setup-ledger.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerStatementTools } from "./tools/statements.js";
import { registerImportTools } from "./tools/import.js";
import { registerUsageTool } from "./tools/usage.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

export function createMcpServer(
  engine: LedgerEngine,
  systemUserId: string,
  db: Database,
): McpServer {
  const server = new McpServer({
    name: "ledge-mcp",
    version: "0.1.0",
  });

  // Tools
  registerSetupTools(server, engine, systemUserId);
  registerTransactionTools(server, engine);
  registerAccountTools(server, engine);
  registerStatementTools(server, engine);
  registerImportTools(server, engine);
  registerUsageTool(server, db);

  // Resources
  registerResources(server, engine);

  // Prompts
  registerPrompts(server);

  return server;
}
