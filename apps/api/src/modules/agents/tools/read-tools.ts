import { Inject, Injectable } from "@nestjs/common";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { getEffectiveCapabilities } from "../../../auth/capability.util";
import { orgMoneySettings } from "../../../common/money-format";
import { AgentApi, AgentCallError } from "../agent-api";
import type { AgentContext, AgentToolRegistrar } from "../mcp-context";
import { readableTypes, type RecordType } from "./record-types";
import { toolError, toolResult, webLink, withFormattedMoney } from "./presenting";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
type Row = Record<string, unknown> & { id?: string };

/**
 * US-MCP-05 (D-259) — `search`, `list_records` and `get_record`: what the
 * person can find and open in Spine, read through Spine's own routes as them
 * (AgentApi), so sections, Field's rules and "without money" apply as on the
 * web. Only the record types they can open are offered.
 */
@Injectable()
export class ReadTools implements AgentToolRegistrar {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly api: AgentApi,
  ) {}

  async register(server: McpServer, ctx: AgentContext): Promise<void> {
    const types = readableTypes(ctx.role, await getEffectiveCapabilities(this.db, { orgId: ctx.orgId, userId: ctx.userId }));
    if (!types.length) return;
    const keys = types.map((t) => t.key) as [string, ...string[]];
    const typeOf = (key: string) => types.find((t) => t.key === key)!;
    const { locale } = await orgMoneySettings(this.db, ctx.orgId);
    const present = (type: RecordType, row: Row) => ({ ...(withFormattedMoney(row, locale) as Row), link: row.id ? webLink(type.web(row.id)) : null });

    server.registerTool(
      "search",
      {
        title: "Search Spine",
        description: `Finds what you could find with Spine's search: contacts (by name, phone, tax ID or person), documents (by number or amount), leads, jobs and catalogue items — only what you can open. Returns each match with its type, id and link; use get_record for the details.`,
        inputSchema: { query: z.string().trim().min(1).max(200).describe("Words, a document number or an amount") },
        annotations: READ,
      },
      async ({ query }) => {
        try {
          return toolResult(withFormattedMoney(await this.api.get(ctx, `/search?q=${encodeURIComponent(query)}&limit=20`), locale));
        } catch (err) {
          return toolError(err);
        }
      },
    );

    server.registerTool(
      "list_records",
      {
        title: "List records",
        description: `Lists ${types.map((t) => `${t.label}s`).join(", ")} as you'd see them in Spine, newest first, with filters. Amounts come as minor units with a currency and formatted. Pages of 25 (at most 100); pass the returned cursor for the next page.`,
        inputSchema: {
          type: z.enum(keys).describe("What to list"),
          status: z.string().max(40).optional().describe("A status as Spine names it: invoices draft, issued or overdue; quotes draft, sent, accepted or rejected; vendor bills draft or recorded; expenses submitted, approved or rejected"),
          contactId: z.string().uuid().optional(),
          jobId: z.string().uuid().optional(),
          contactType: z.enum(["customer", "vendor", "both"]).optional().describe("Contacts only"),
          search: z.string().max(200).optional().describe("Contacts only: name, email or phone"),
          limit: z.number().int().min(1).max(100).optional(),
          cursor: z.string().regex(/^\d+$/).optional(),
        },
        annotations: READ,
      },
      async (args) => {
        const type = typeOf(args.type);
        const params = new URLSearchParams();
        if (args.status && type.filters.includes("status")) params.set("status", args.status);
        if (args.contactId && type.filters.includes("contactId")) params.set("contactId", args.contactId);
        if (args.jobId && type.filters.includes("jobId")) params.set("jobId", args.jobId);
        if (args.contactType && type.filters.includes("type")) params.set("type", args.contactType);
        if (args.search && type.filters.includes("search")) params.set("search", args.search);
        try {
          const rows = await this.api.get<Row[]>(ctx, `${type.api}${params.size ? `?${params}` : ""}`);
          const start = Number(args.cursor ?? 0);
          const size = args.limit ?? 25;
          const page = rows.slice(start, start + size);
          return toolResult({ type: type.key, total: rows.length, items: page.map((r) => present(type, r)), nextCursor: start + size < rows.length ? String(start + size) : null });
        } catch (err) {
          return toolError(err);
        }
      },
    );

    server.registerTool(
      "get_record",
      {
        title: "Open a record",
        description: "Opens one record as its page in Spine shows it — lines, tax, totals, balance, status, dates — by id, or for documents by number (e.g. INV-0042). Includes its link.",
        inputSchema: {
          type: z.enum(keys),
          id: z.string().uuid().optional(),
          number: z.string().trim().min(1).max(60).optional().describe("A document number, bill number or reference"),
        },
        annotations: READ,
      },
      async ({ type: key, id, number }) => {
        const type = typeOf(key);
        const notFound = `No ${type.label}${number ? ` ${number}` : ""} that you can open.`;
        try {
          let recordId = id;
          if (!recordId && number) {
            const rows = await this.api.get<Row[]>(ctx, type.api);
            const want = number.toLowerCase();
            recordId = rows.find((r) => [r.number, r.billNumber, r.reference].some((v) => typeof v === "string" && v.toLowerCase() === want))?.id;
          }
          if (!recordId) return toolError(new AgentCallError(404, id || number ? notFound : `Give the ${type.label}'s id or number.`));
          return toolResult(present(type, await this.api.get<Row>(ctx, `${type.api}/${recordId}`)));
        } catch (err) {
          return toolError(err instanceof AgentCallError && (err.status === 404 || err.status === 400) ? new AgentCallError(404, notFound) : err);
        }
      },
    );
  }
}
