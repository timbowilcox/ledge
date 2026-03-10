// ---------------------------------------------------------------------------
// MCP Prompt Templates — reusable accounting workflows for AI assistants.
// ---------------------------------------------------------------------------

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // -----------------------------------------------------------------------
  // Monthly Close
  // -----------------------------------------------------------------------
  server.prompt(
    "monthly-close",
    "Step-by-step month-end close workflow for a ledger.",
    {
      ledgerId: z.string().describe("Ledger ID"),
      month: z.string().describe("Month to close (YYYY-MM format, e.g. 2024-03)"),
    },
    async ({ ledgerId, month }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Perform a month-end close for ledger ${ledgerId}, month ${month}.`,
              "",
              "Follow these steps:",
              "",
              "1. **Review unposted items**: Use search_transactions to find all transactions in the period.",
              "2. **Verify completeness**: Check that all expected revenue, expenses, and accruals are recorded.",
              "3. **Generate trial balance**: Use list_accounts to review all account balances.",
              "4. **Generate financial statements**:",
              `   - Income Statement: Use get_statement with type=pnl, startDate=${month}-01, endDate=${month}-31`,
              `   - Balance Sheet: Use get_statement with type=balance_sheet, asOfDate=${month}-31`,
              `   - Cash Flow: Use get_statement with type=cash_flow, startDate=${month}-01, endDate=${month}-31`,
              "5. **Review for anomalies**: Look for unusual balances, missing entries, or accounts that seem off.",
              "6. **Reconcile**: Compare bank statement balances to the ledger cash account balances.",
              "7. **Report findings**: Summarize the financial position and any issues found.",
              "",
              "Important: Do NOT close the period until all items have been reviewed and confirmed.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // -----------------------------------------------------------------------
  // Reconcile Bank
  // -----------------------------------------------------------------------
  server.prompt(
    "reconcile-bank",
    "Guide for reconciling a bank account against a statement balance.",
    {
      ledgerId: z.string().describe("Ledger ID"),
      accountCode: z.string().describe("Bank account code (e.g. 1000)"),
      statementBalance: z.string().describe("Bank statement ending balance in cents (e.g. 150000 for $1,500.00)"),
    },
    async ({ ledgerId, accountCode, statementBalance }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Reconcile bank account ${accountCode} in ledger ${ledgerId}.`,
              `The bank statement ending balance is ${statementBalance} (in smallest currency unit).`,
              "",
              "Follow these steps:",
              "",
              "1. **Get ledger balance**: Use list_accounts to find the current balance for account " + accountCode + ".",
              "2. **Compare balances**: Calculate the difference between the ledger balance and the statement balance.",
              "3. **If balanced**: Report that the account reconciles.",
              "4. **If unbalanced**: Investigate the difference:",
              "   - Use search_transactions to review recent transactions involving this account.",
              "   - Look for outstanding checks, deposits in transit, or missing entries.",
              "   - Identify any bank fees or interest not yet recorded.",
              "5. **Post adjustments**: If needed, use post_transaction to record any missing items:",
              "   - Bank fees (debit Expense, credit Bank)",
              "   - Interest earned (debit Bank, credit Revenue)",
              "   - Corrections for any errors found",
              "6. **Verify**: Re-check the balance after adjustments.",
              "7. **Report**: Summarize the reconciliation status and any adjustments made.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // -----------------------------------------------------------------------
  // Explain Statement
  // -----------------------------------------------------------------------
  server.prompt(
    "explain-statement",
    "Generate a financial statement and explain it in plain English.",
    {
      ledgerId: z.string().describe("Ledger ID"),
      statementType: z
        .enum(["pnl", "balance_sheet", "cash_flow"])
        .describe("Statement type"),
      startDate: z.string().optional().describe("Period start date (for pnl and cash_flow)"),
      endDate: z.string().optional().describe("Period end date (for pnl and cash_flow)"),
      asOfDate: z.string().optional().describe("Point-in-time date (for balance_sheet)"),
    },
    async ({ ledgerId, statementType, startDate, endDate, asOfDate }) => {
      const dateInstruction =
        statementType === "balance_sheet"
          ? `Use get_statement with type=balance_sheet, asOfDate=${asOfDate ?? "today"}`
          : `Use get_statement with type=${statementType}, startDate=${startDate ?? "start-of-month"}, endDate=${endDate ?? "today"}`;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Generate and explain the ${statementType.replace("_", " ")} for ledger ${ledgerId}.`,
                "",
                "Steps:",
                "",
                `1. **Generate the statement**: ${dateInstruction}`,
                "2. **Read the plain language summary** from the statement response.",
                "3. **Explain each section** in simple terms:",
                statementType === "pnl"
                  ? "   - Revenue: Where money is coming from\n   - Cost of Revenue: Direct costs of delivering the product/service\n   - Gross Profit: Revenue minus costs\n   - Operating Expenses: Overhead costs\n   - Net Income: The bottom line — profit or loss"
                  : statementType === "balance_sheet"
                    ? "   - Assets: What the business owns\n   - Liabilities: What the business owes\n   - Equity: The owner's stake (Assets minus Liabilities)"
                    : "   - Operating Activities: Cash from day-to-day business\n   - Investing Activities: Cash used for long-term investments\n   - Financing Activities: Cash from loans, investors, or distributions",
                "4. **Highlight key metrics** and what they mean for the business health.",
                "5. **Flag any concerns**: negative trends, unusual items, or areas needing attention.",
                "6. **Provide actionable recommendations** based on the financial data.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );
}
