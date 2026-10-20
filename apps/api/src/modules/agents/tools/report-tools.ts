import { Inject, Injectable } from "@nestjs/common";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PL_COMPARE_MODES, RECEIVABLES_AGES, type Capability } from "@spine/shared";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { getEffectiveCapabilities } from "../../../auth/capability.util";
import { orgMoneySettings } from "../../../common/money-format";
import { AgentApi } from "../agent-api";
import type { AgentContext, AgentToolRegistrar } from "../mcp-context";
import { toolError, toolResult, webLink, withFormattedMoney } from "./presenting";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30.");

interface ReportTool {
  name: string;
  title: string;
  description: string;
  capability: Capability;
  input: z.ZodRawShape;
  path: (args: Record<string, unknown>) => string;
  web: string;
}

const qs = (args: Record<string, unknown>, keys: string[]) => {
  const p = new URLSearchParams();
  for (const k of keys) if (args[k] !== undefined && args[k] !== null && args[k] !== "") p.set(k, String(args[k]));
  return p.size ? `?${p}` : "";
};

/**
 * US-MCP-06 (D-259) — Spine's reports for agents. Each tool calls the same
 * report route as the Reports page (journal lines, the same basis), so the
 * figures are the report's, never a second calculation; each is listed only
 * for a person whose capabilities open that report, and Field gets none.
 */
const REPORTS: readonly ReportTool[] = [
  {
    name: "receivables",
    title: "Who owes us",
    description: "Money customers owe: totals by age (current, 0-30 … 90+ days overdue) and each open invoice by customer, as the Receivables report shows it.",
    capability: "reports.view_receivables",
    input: { age: z.enum(RECEIVABLES_AGES).optional().describe("Only invoices of this age, e.g. overdue") },
    path: (a) => `/reports/receivables${qs(a, ["age"])}`,
    web: "/receivables",
  },
  {
    name: "payables",
    title: "What we owe",
    description: "Money owed to vendors: totals by age and each open bill by vendor, as the Payables report shows it.",
    capability: "reports.view_payables",
    input: {},
    path: () => "/reports/payables",
    web: "/payables",
  },
  {
    name: "profit_and_loss",
    title: "Profit and loss",
    description: "Income, expenses and profit for a period, on accrual or cash basis, with an optional comparison — the Profit & Loss report.",
    capability: "reports.view_financial_statements",
    input: { from: date, to: date, basis: z.enum(["accrual", "cash"]).optional(), compare: z.enum(PL_COMPARE_MODES).optional().describe("previous: the period before; last_year: the same period last year; monthly: each month") },
    path: (a) => `/reports/profit-and-loss${qs(a, ["from", "to", "basis", "compare"])}`,
    web: "/reports/profit-and-loss",
  },
  {
    name: "balance_sheet",
    title: "Balance sheet",
    description: "Assets, liabilities and equity as of a date, optionally compared with another date — the Balance Sheet report.",
    capability: "reports.view_financial_statements",
    input: { asOf: date, compareAsOf: date.optional() },
    path: (a) => `/reports/balance-sheet${qs(a, ["asOf", "compareAsOf"])}`,
    web: "/reports/balance-sheet",
  },
  {
    name: "job_profitability",
    title: "Job profitability",
    description: "For each job: contract value, invoiced, costs and margin, from the books — the Job Profitability report.",
    capability: "reports.view_job_profitability",
    input: { status: z.string().max(40).optional().describe("Only jobs with this status, e.g. in_progress") },
    path: (a) => `/reports/job-profitability${qs(a, ["status"])}`,
    web: "/reports/job-profitability",
  },
  {
    name: "bank_balances",
    title: "Bank balances",
    description: "Each bank and cash account with its balance in the books.",
    capability: "banking.view",
    input: {},
    path: () => "/money-accounts",
    web: "/banking",
  },
  {
    name: "dashboard_summary",
    title: "How the business is doing",
    description: "The dashboard's figures: money in and out, what's owed each way and the month so far.",
    capability: "reports.view_dashboard_summary",
    input: {},
    path: () => "/reports/dashboard-summary",
    web: "/dashboard",
  },
];

@Injectable()
export class ReportTools implements AgentToolRegistrar {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly api: AgentApi,
  ) {}

  async register(server: McpServer, ctx: AgentContext): Promise<void> {
    if (ctx.role === "field") return;
    const capabilities = await getEffectiveCapabilities(this.db, { orgId: ctx.orgId, userId: ctx.userId });
    const { locale } = await orgMoneySettings(this.db, ctx.orgId);
    for (const report of REPORTS) {
      if (!capabilities[report.capability]) continue;
      server.registerTool(report.name, { title: report.title, description: report.description, inputSchema: report.input, annotations: READ }, async (args: Record<string, unknown>) => {
        try {
          const data = withFormattedMoney(await this.api.get(ctx, report.path(args)), locale);
          return toolResult({ report: report.title, link: webLink(report.web), ...(Array.isArray(data) ? { items: data } : (data as Record<string, unknown>)) });
        } catch (err) {
          return toolError(err);
        }
      });
    }
  }
}
