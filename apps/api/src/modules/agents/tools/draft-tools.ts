import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AGENT_SCOPES, itemTaxFor } from "@spine/shared";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { getEffectiveCapabilities } from "../../../auth/capability.util";
import { orgMoneySettings } from "../../../common/money-format";
import { SlidingWindowLimiter } from "../../../auth/password-reset";
import { AgentApi } from "../agent-api";
import { AgentCallError } from "../agent-call-error";
import { AgentsSettingsService } from "../agents-settings.service";
import type { AgentContext, AgentToolRegistrar } from "../mcp-context";
import { toolError, toolResult, webLink, withFormattedMoney } from "./presenting";

/** Drafts create something, but never destroy or send anything (D-259). */
const DRAFT = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const minor = z.string().regex(/^\d+$/, "Give amounts in minor units, e.g. 125000 for 1,250.00.");
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Use a currency code like USD.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-20.");

/** US-MCP-07 (D-258) — 30 drafts an hour per connection. */
export const draftLimiter = new SlidingWindowLimiter({ max: 30, windowMs: 60 * 60_000 });
export const TOO_MANY_DRAFTS = "Too many drafts from this agent. Try again later.";

/**
 * A retried call is the same call: the same connection, tool, request and
 * arguments give the same Idempotency-Key, so Spine returns the first result
 * and creates nothing twice (D-259). Shaped as a UUID, as the routes expect.
 */
export function draftKey(ctx: AgentContext, tool: string, requestId: string | number | undefined, args: unknown, part = ""): string {
  const hex = createHash("sha256").update(JSON.stringify([ctx.connectionId, tool, requestId ?? null, args, part])).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type Row = Record<string, unknown> & { id: string };
interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  interTaxRateId?: string | null;
  interTaxGroupId?: string | null;
  hsnSac?: string | null;
}

const lineInput = z.object({
  catalogItemId: z.string().uuid().optional().describe("A catalogue item: its name, price and tax are used unless you give them"),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  quantity: z.number().positive().max(1_000_000),
  unitPriceAmount: minor.optional().describe("Price per unit in minor units; needed for a line without a catalogue item"),
});

/**
 * US-MCP-07 (D-256, D-259) — what an agent can start for the person: a lead
 * (with the enquiry as its first note), a draft quote, a draft vendor bill,
 * a note. Each goes through Spine's normal create route as the person, so
 * Spine computes totals and tax and its rules apply; nothing is issued,
 * sent, recorded or posted — the answer links to the draft for the person to
 * check and finish. Offered only with `spine:draft`, while the Owner allows
 * drafts, and per the person's rights (Field: notes on their jobs).
 */
@Injectable()
export class DraftTools implements AgentToolRegistrar {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly api: AgentApi,
    private readonly settings: AgentsSettingsService,
  ) {}

  async register(server: McpServer, ctx: AgentContext): Promise<void> {
    if (!ctx.scopes.has(AGENT_SCOPES.draft) || !(await this.settings.stored(ctx.orgId)).drafts) return;
    const can = await getEffectiveCapabilities(this.db, { orgId: ctx.orgId, userId: ctx.userId });
    const { currency: orgCurrency, locale } = await orgMoneySettings(this.db, ctx.orgId);
    const office = ctx.role !== "field";

    /** Runs a draft tool: the hourly limit, then the work, with refusals in Spine's words. */
    const run = async (work: () => Promise<Record<string, unknown>>) => {
      if (!draftLimiter.hit(ctx.connectionId)) return toolError(new AgentCallError(429, TOO_MANY_DRAFTS));
      try {
        return toolResult(withFormattedMoney(await work(), locale));
      } catch (err) {
        return toolError(err);
      }
    };

    const lines = async (input: z.infer<typeof lineInput>[], currency: string) =>
      Promise.all(
        input.map(async (l) => {
          if (!l.catalogItemId) {
            if (!l.name || l.unitPriceAmount === undefined) throw new AgentCallError(400, "Each line needs a catalogue item, or a name and a price.");
            return { type: "item", name: l.name, description: l.description ?? null, quantity: l.quantity, unitPriceAmount: l.unitPriceAmount };
          }
          const item = await this.api.get<CatalogItem>(ctx, `/catalog-items/${l.catalogItemId}`);
          if (l.unitPriceAmount === undefined && item.defaultPriceCurrency !== currency) throw new AgentCallError(400, `${item.name} is priced in ${item.defaultPriceCurrency}. Give its price in ${currency}.`);
          return {
            type: "item",
            catalogItemId: item.id,
            name: l.name ?? item.name,
            description: l.description ?? item.description,
            quantity: l.quantity,
            unitPriceAmount: l.unitPriceAmount ?? item.defaultPriceAmount,
            ...itemTaxFor({ defaultTaxRateId: item.defaultTaxRateId, defaultTaxGroupId: item.defaultTaxGroupId, interTaxRateId: item.interTaxRateId ?? null, interTaxGroupId: item.interTaxGroupId ?? null }, null),
            hsnSac: item.hsnSac ?? null,
          };
        }),
      );

    if (office && can["leads.edit_own"]) {
      server.registerTool(
        "create_lead",
        {
          title: "Create a lead",
          description: "Creates a lead for a customer with the enquiry as its first note — adding the customer as a contact if they're new. Use an existing contact's id when there is one (find it with search).",
          inputSchema: {
            contactId: z.string().uuid().optional(),
            newContact: z.object({ name: z.string().trim().min(1).max(200), email: z.string().email().optional(), phone: z.string().max(40).optional(), isCompany: z.boolean().optional() }).optional(),
            title: z.string().trim().min(1).max(200),
            enquiry: z.string().trim().min(1).max(4000).describe("What they asked for, in their words"),
            valueAmount: minor.optional(),
            currency: currencyCode.optional(),
            source: z.string().max(100).optional(),
          },
          annotations: DRAFT,
        },
        (args, extra) =>
          run(async () => {
            if (!args.contactId && !args.newContact) throw new AgentCallError(400, "Give the contact's id, or the new contact's name.");
            let contactId = args.contactId;
            if (!contactId) {
              if (!can["contacts.edit_own"]) throw new AgentCallError(403, "You don't have permission to add contacts.");
              const n = args.newContact!;
              contactId = (await this.api.send<Row>(ctx, "POST", "/contacts", { type: "customer", isCompany: n.isCompany ?? false, name: n.name, email: n.email ?? null, phone: n.phone ?? null }, draftKey(ctx, "create_lead", extra.requestId, args, "contact"))).id;
            }
            const lead = await this.api.send<Row>(
              ctx,
              "POST",
              "/leads",
              { contactId, title: args.title, valueCurrency: args.currency ?? orgCurrency, ...(args.valueAmount ? { valueAmount: args.valueAmount } : {}), source: args.source ?? null },
              draftKey(ctx, "create_lead", extra.requestId, args, "lead"),
            );
            await this.api.send(ctx, "POST", "/activities", { leadId: lead.id, contactId, type: "note", notes: args.enquiry }, draftKey(ctx, "create_lead", extra.requestId, args, "note"));
            return { lead, link: webLink("/leads"), message: "Created the lead. Open it in Spine to check it." };
          }),
      );
    }

    if (office && can["quotes.edit_own"]) {
      server.registerTool(
        "draft_quote",
        {
          title: "Draft a quote",
          description: "Creates a draft quote for a customer. Lines can name catalogue items (their price and tax are used) or be free text with a quantity and price. Spine works out tax and totals. Nothing is sent: the answer links to the draft for the person to check and send in Spine.",
          inputSchema: {
            contactId: z.string().uuid(),
            title: z.string().trim().max(120).optional(),
            currency: currencyCode.optional(),
            validUntil: date.optional(),
            notes: z.string().max(4000).optional(),
            lines: z.array(lineInput).min(1).max(50),
          },
          annotations: DRAFT,
        },
        (args, extra) =>
          run(async () => {
            const currency = args.currency ?? orgCurrency;
            const quote = await this.api.send<Row>(
              ctx,
              "POST",
              "/quotes",
              { contactId: args.contactId, title: args.title ?? null, currency, validUntil: args.validUntil ?? null, notes: args.notes ?? null, lines: await lines(args.lines, currency) },
              draftKey(ctx, "draft_quote", extra.requestId, args),
            );
            return { quote, link: webLink(`/quotes/${quote.id}`), message: "Created a draft quote. Open it in Spine to check and send it — it gets its number when it's sent." };
          }),
      );
    }

    if (office && can["vendor_bills.edit_own"]) {
      server.registerTool(
        "draft_vendor_bill",
        {
          title: "Draft a vendor bill",
          description: "Creates a draft vendor bill from a vendor's bill — its number, date and lines. Spine works out tax and totals. It's a draft: nothing is recorded or posted until the person records it in Spine.",
          inputSchema: {
            contactId: z.string().uuid().describe("The vendor"),
            billNumber: z.string().trim().min(1).max(60).describe("The vendor's own number for the bill"),
            date,
            dueDate: date.optional(),
            currency: currencyCode.optional(),
            jobId: z.string().uuid().optional(),
            notes: z.string().max(4000).optional(),
            lines: z.array(lineInput).min(1).max(100),
          },
          annotations: DRAFT,
        },
        (args, extra) =>
          run(async () => {
            const currency = args.currency ?? orgCurrency;
            const bill = await this.api.send<Row>(
              ctx,
              "POST",
              "/vendor-bills",
              { contactId: args.contactId, billNumber: args.billNumber, date: args.date, dueDate: args.dueDate ?? null, currency, jobId: args.jobId ?? null, notes: args.notes ?? null, lines: await lines(args.lines, currency) },
              draftKey(ctx, "draft_vendor_bill", extra.requestId, args),
            );
            return { bill, link: webLink(`/vendor-bills/${bill.id}`), message: "Created a draft bill. Open it in Spine to check and record it — nothing is posted until then." };
          }),
      );
    }

    const targets = [...(office && can["activities.edit_own"] ? (["contact", "lead"] as const) : []), ...(can["job_notes.edit_own"] ? (["job"] as const) : [])];
    if (targets.length) {
      server.registerTool(
        "add_note",
        {
          title: "Add a note",
          description: ctx.role === "field" ? "Adds a note to a job you're assigned to." : "Adds a note to a contact, a lead or a job you can change.",
          inputSchema: { on: z.enum(targets as unknown as [string, ...string[]]), id: z.string().uuid(), text: z.string().trim().min(1).max(4000) },
          annotations: DRAFT,
        },
        ({ on, id, text }, extra) =>
          run(async () => {
            const key = draftKey(ctx, "add_note", extra.requestId, { on, id, text });
            const note = on === "job" ? await this.api.send<Row>(ctx, "POST", `/jobs/${id}/notes`, { body: text }, key) : await this.api.send<Row>(ctx, "POST", "/activities", { [on === "lead" ? "leadId" : "contactId"]: id, type: "note", notes: text }, key);
            return { note, link: webLink(on === "job" ? `/jobs/${id}` : on === "contact" ? `/contacts/${id}` : "/leads"), message: "Added the note." };
          }),
      );
    }
  }
}
