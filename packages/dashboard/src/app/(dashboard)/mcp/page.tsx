"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

type Tool = "claude-code-hosted" | "claude-code-local" | "claude-desktop" | "cursor-hosted" | "cursor-local";

const configs: Record<Tool, { label: string; file: string; config: string; steps: string[] }> = {
  "claude-desktop": {
    label: "Claude Desktop",
    file: "claude_desktop_config.json",
    config: `{
  "mcpServers": {
    "kounta": {
      "url": "https://mcp.kounta.ai/sse?key=YOUR_API_KEY"
    }
  }
}`,
    steps: [
      "Open Claude Desktop settings",
      "Navigate to the MCP servers section",
      "Add the configuration below",
      "Replace YOUR_API_KEY with your API key from the Settings page",
      "Restart Claude Desktop",
    ],
  },
  "claude-code-hosted": {
    label: "Claude Code (Hosted)",
    file: ".claude/settings.json",
    config: `{
  "mcpServers": {
    "kounta": {
      "url": "https://mcp.kounta.ai/sse?key=YOUR_API_KEY"
    }
  }
}`,
    steps: [
      "Open your project in Claude Code",
      "Create or edit .claude/settings.json in your project root",
      "Paste the configuration below",
      "Replace YOUR_API_KEY with your API key from the Settings page",
      "Restart Claude Code to load the MCP server",
    ],
  },
  "claude-code-local": {
    label: "Claude Code (Local)",
    file: ".claude/settings.json",
    config: `{
  "mcpServers": {
    "kounta": {
      "command": "npx",
      "args": ["@kounta/mcp", "--stdio"]
    }
  }
}`,
    steps: [
      "Open your project in Claude Code",
      "Create or edit .claude/settings.json in your project root",
      "Paste the configuration below",
      "This runs a local MCP server with an embedded SQLite database",
      "No API key needed \u2014 data stays on your machine",
    ],
  },
  "cursor-hosted": {
    label: "Cursor (Hosted)",
    file: ".cursor/mcp.json",
    config: `{
  "mcpServers": {
    "kounta": {
      "url": "https://mcp.kounta.ai/sse?key=YOUR_API_KEY"
    }
  }
}`,
    steps: [
      "Open your project in Cursor",
      "Create or edit .cursor/mcp.json in your project root",
      "Paste the configuration below",
      "Replace YOUR_API_KEY with your API key from the Settings page",
      "Cursor will detect the MCP server automatically",
    ],
  },
  "cursor-local": {
    label: "Cursor (Local)",
    file: ".cursor/mcp.json",
    config: `{
  "mcpServers": {
    "kounta": {
      "command": "npx",
      "args": ["@kounta/mcp", "--stdio"]
    }
  }
}`,
    steps: [
      "Open your project in Cursor",
      "Create or edit .cursor/mcp.json in your project root",
      "Paste the configuration below",
      "This runs a local MCP server with an embedded SQLite database",
      "No API key needed \u2014 data stays on your machine",
    ],
  },
};

export default function McpPage() {
  const [activeTool, setActiveTool] = useState<Tool>("claude-desktop");
  const [showAll, setShowAll] = useState(false);
  const config = configs[activeTool];

  const visibleTools = showAll ? mcpTools : mcpTools.slice(0, 12);

  return (
    <div>
      <h1
        className="font-bold"
        style={{ fontSize: 24, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-family-display)" }}
      >
        MCP Connection Guide
      </h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
        Connect Kounta to your AI coding assistant. Your agent can then set up ledgers,
        post transactions, generate financial statements, classify bank transactions,
        and more \u2014 all conversationally.
      </p>

      {/* Hosted endpoint callout */}
      <div
        style={{
          padding: "14px 18px",
          borderRadius: 12,
          backgroundColor: "var(--surface-1)",
          border: "1px solid var(--border)",
          marginBottom: 32,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Hosted Endpoint
          </div>
          <code className="text-xs font-mono" style={{ color: "var(--accent)" }}>
            https://mcp.kounta.ai
          </code>
          <span className="text-xs" style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
            39 tools &middot; 4 resources &middot; 3 prompts
          </span>
        </div>
      </div>

      {/* Tool selector */}
      <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 32 }}>
        {(Object.entries(configs) as [Tool, typeof config][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: activeTool === key ? "var(--surface-1)" : "transparent",
              color: activeTool === key ? "var(--text-primary)" : "var(--text-tertiary)",
              border: activeTool === key ? "1px solid var(--border-strong)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Setup Steps</div>
        <ol style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {config.steps.map((step, i) => (
            <li key={i} className="flex text-sm" style={{ color: "var(--text-secondary)", gap: 14 }}>
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ paddingTop: 4, lineHeight: 1.5 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Config block */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="section-label">
            Configuration &mdash; <code className="font-mono text-xs" style={{ color: "var(--accent)" }}>{config.file}</code>
          </div>
          <CopyButton text={config.config} label="Copy config" />
        </div>
        <div
          style={{
            borderRadius: 18,
            padding: 24,
            backgroundColor: "var(--surface-1)",
            border: "1px solid var(--border)",
          }}
        >
          <pre className="font-mono text-sm overflow-x-auto" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {config.config.split("\n").map((line, i) => {
              if (line.includes("YOUR_API_KEY")) {
                const parts = line.split("YOUR_API_KEY");
                return (
                  <div key={i}>
                    <span>{parts[0]}</span>
                    <span style={{ color: "var(--warning)", fontWeight: 500 }}>YOUR_API_KEY</span>
                    <span>{parts[1]}</span>
                  </div>
                );
              }
              if (line.includes('"kounta"') || line.includes('"mcpServers"')) {
                return <div key={i} style={{ color: "var(--accent)" }}>{line}</div>;
              }
              return <div key={i}>{line}</div>;
            })}
          </pre>
        </div>
      </div>

      {/* Available tools */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div className="section-label">All 39 MCP Tools</div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-medium"
            style={{ color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
          >
            {showAll ? "Show less" : "Show all 39"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
          {visibleTools.map((tool) => (
            <div key={tool.name} className="card" style={{ padding: 16 }}>
              <div className="flex items-start justify-between" style={{ gap: 8 }}>
                <code className="font-mono text-xs font-medium" style={{ color: "var(--accent)" }}>
                  {tool.name}
                </code>
                <span
                  className="text-xs flex-shrink-0"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    backgroundColor: categoryColors[tool.category] ?? "var(--surface-1)",
                    color: categoryTextColors[tool.category] ?? "var(--text-tertiary)",
                    fontWeight: 500,
                  }}
                >
                  {tool.category}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                {tool.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Resources (4)</div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
          {mcpResources.map((r) => (
            <div key={r.uri} className="card" style={{ padding: 16 }}>
              <code className="font-mono text-xs font-medium" style={{ color: "var(--positive)" }}>
                {r.uri}
              </code>
              <p className="text-xs" style={{ color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                {r.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Prompts */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Prompt Templates (3)</div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
          {mcpPrompts.map((p) => (
            <div key={p.name} className="card" style={{ padding: 16 }}>
              <code className="font-mono text-xs font-medium" style={{ color: "var(--accent)" }}>
                {p.name}
              </code>
              <p className="text-xs" style={{ color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Example prompts */}
      <div>
        <div className="section-label" style={{ marginBottom: 16 }}>Example Prompts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {examplePrompts.map((p, i) => (
            <div
              key={i}
              className="text-sm"
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                backgroundColor: "var(--surface-1)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              &ldquo;{p}&rdquo;
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const categoryColors: Record<string, string> = {
  Setup: "var(--surface-1)",
  Transactions: "var(--surface-1)",
  Accounts: "var(--surface-1)",
  Reports: "var(--surface-1)",
  Import: "var(--surface-1)",
  "Bank Feeds": "var(--surface-1)",
  Notifications: "var(--surface-1)",
  Currencies: "var(--surface-1)",
  Classification: "var(--surface-1)",
  Recurring: "var(--surface-1)",
  Usage: "var(--surface-1)",
  Stripe: "var(--surface-1)",
};

const categoryTextColors: Record<string, string> = {
  Setup: "var(--text-secondary)",
  Transactions: "var(--text-secondary)",
  Accounts: "var(--text-secondary)",
  Reports: "var(--text-secondary)",
  Import: "var(--text-secondary)",
  "Bank Feeds": "var(--text-secondary)",
  Notifications: "var(--text-secondary)",
  Currencies: "var(--text-secondary)",
  Classification: "var(--text-secondary)",
  Recurring: "var(--text-secondary)",
  Usage: "var(--text-secondary)",
  Stripe: "var(--text-secondary)",
};

const mcpTools = [
  { name: "setup_ledger", description: "Auto-provision a ledger from a business description", category: "Setup" },
  { name: "complete_setup", description: "Finalize ledger setup with a chosen template", category: "Setup" },
  { name: "post_transaction", description: "Record a balanced double-entry transaction", category: "Transactions" },
  { name: "reverse_transaction", description: "Reverse a posted transaction with offsetting entry", category: "Transactions" },
  { name: "search_transactions", description: "Search and paginate through transactions", category: "Transactions" },
  { name: "list_accounts", description: "List all accounts with current balances", category: "Accounts" },
  { name: "create_account", description: "Add a new account to the chart of accounts", category: "Accounts" },
  { name: "get_statement", description: "Generate P&L, balance sheet, or cash flow statement", category: "Reports" },
  { name: "import_file", description: "Import CSV or OFX bank data with auto-matching", category: "Import" },
  { name: "confirm_matches", description: "Confirm or reject import match suggestions", category: "Import" },
  { name: "get_import_batch", description: "Get import batch details with all rows", category: "Import" },
  { name: "list_bank_connections", description: "List all bank feed connections for the ledger", category: "Bank Feeds" },
  { name: "list_bank_accounts", description: "List bank accounts for a connection", category: "Bank Feeds" },
  { name: "sync_bank_account", description: "Trigger a bank account transaction sync", category: "Bank Feeds" },
  { name: "list_bank_transactions", description: "List synced bank transactions with match status", category: "Bank Feeds" },
  { name: "confirm_bank_match", description: "Confirm or ignore a bank transaction match", category: "Bank Feeds" },
  { name: "map_bank_account", description: "Map a bank account to a ledger account", category: "Bank Feeds" },
  { name: "list_notifications", description: "List notifications with status and type filters", category: "Notifications" },
  { name: "get_notification", description: "Get a single notification by ID", category: "Notifications" },
  { name: "update_notification", description: "Update notification status (read, dismissed, actioned)", category: "Notifications" },
  { name: "generate_insights", description: "Run all analyzers and create insight notifications", category: "Notifications" },
  { name: "enable_currency", description: "Enable a currency on a ledger for multi-currency", category: "Currencies" },
  { name: "set_exchange_rate", description: "Set an exchange rate between two currencies", category: "Currencies" },
  { name: "list_exchange_rates", description: "List exchange rates, optionally filtered by pair", category: "Currencies" },
  { name: "convert_amount", description: "Convert an amount between currencies using stored rates", category: "Currencies" },
  { name: "revalue_accounts", description: "Revalue foreign-currency accounts at current rates", category: "Currencies" },
  { name: "classify_transaction", description: "Preview how a description would be classified", category: "Classification" },
  { name: "classify_bank_transaction", description: "Classify a bank transaction to a ledger account", category: "Classification" },
  { name: "create_classification_rule", description: "Create an auto-classification rule", category: "Classification" },
  { name: "list_classification_rules", description: "List all classification rules", category: "Classification" },
  { name: "list_merchant_aliases", description: "List merchant name aliases", category: "Classification" },
  { name: "create_recurring_entry", description: "Create a recurring journal entry", category: "Recurring" },
  { name: "list_recurring_entries", description: "List all recurring entries for a ledger", category: "Recurring" },
  { name: "update_recurring_entry", description: "Update a recurring entry schedule or amounts", category: "Recurring" },
  { name: "pause_recurring_entry", description: "Pause a recurring entry", category: "Recurring" },
  { name: "resume_recurring_entry", description: "Resume a paused recurring entry", category: "Recurring" },
  { name: "get_usage", description: "Check account, transaction, and line item counts", category: "Usage" },
  { name: "get_stripe_status", description: "Get Stripe connection status for the ledger", category: "Stripe" },
  { name: "sync_stripe", description: "Trigger Stripe data sync (last 90 days)", category: "Stripe" },
];

const mcpResources = [
  { uri: "ledger://{id}/chart-of-accounts", description: "Full chart of accounts with codes, names, types, and balances" },
  { uri: "ledger://{id}/pnl{?start,end}", description: "Income statement for a date range" },
  { uri: "ledger://{id}/balance-sheet{?as_of}", description: "Balance sheet as of a specific date" },
  { uri: "ledger://{id}/recent-transactions{?limit}", description: "Most recent transactions with line items" },
];

const mcpPrompts = [
  { name: "monthly-close", description: "Guided month-end close workflow: review unreconciled items, generate statements, close the period" },
  { name: "reconcile-bank", description: "Bank reconciliation: compare ledger balance to statement balance and identify discrepancies" },
  { name: "explain-statement", description: "Plain-language explanation of a financial statement with key metrics and trends" },
];

const examplePrompts = [
  "Set up accounting for my SaaS startup that sells monthly subscriptions",
  "Post a $500 payment from Acme Corp for consulting services",
  "Show me my P&L for Q1 2026",
  "Import this CSV bank statement and match transactions",
  "What is my current cash balance?",
  "Create a recurring monthly rent entry for $2,500",
  "Classify all my unmatched bank transactions",
];
