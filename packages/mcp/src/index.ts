#!/usr/bin/env node
// ---------------------------------------------------------------------------
// @ledge/mcp — Entry point
//
// Boots an in-memory SQLite database, creates the MCP server, and connects
// it to a stdio transport for local use.
// ---------------------------------------------------------------------------

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initDatabase } from "./lib/db.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const { engine, db, systemUserId } = await initDatabase();
  const server = createMcpServer(engine, systemUserId, db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting ledge-mcp:", err);
  process.exit(1);
});
