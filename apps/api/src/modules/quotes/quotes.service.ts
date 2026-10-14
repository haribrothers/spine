import { moduleOn } from "../../common/modules";
import { BadRequestException, ForbiddenException, GoneException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { EmailJobOverride } from "../email/email-text";
import type { acceptQuoteInPersonSchema, createQuoteSchema, rejectQuoteInPersonSchema, updateQuoteSchema } from "@spine/shared";
import { computeDocumentLine, lineSupplyClass, resolveDocumentLayout, supplyClassTaxError, QUOTE_NO_LINK, type DocumentLayout, type QuoteActivityEntry, type QuoteCustomerLink, type QuoteRelated, type SupplyClass } from "@spine/shared";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { quotes, quoteLines, quoteEvents, contacts, files, invoices, jobs, jobAssignments, jobVariationOrders, leads, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { getMemberRole, hasCapability, requireOwnershipCapability } from "../../auth/capability.util";
import { RateBook } from "../tax/line-tax-components";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { QueueService } from "../queue/queue.service";
import { queueIssuedPdf } from "../pdf/issued-pdf.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { QuotePdfBusinessProfile } from "../pdf/quote-pdf.template";
import { QUOTE_SEND_EMAIL_QUEUE } from "./quote-email.worker";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { EmailLogService } from "../email/email-log.service";
import { appUrl } from "../email/email-layout";

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

/** Backs the org's discount-approval threshold (S-03.9) via the generic `settings` table, mirroring `default_tax_rate`'s exact convention (see tax.controller.ts). */
const DISCOUNT_THRESHOLD_KEY = "discount_approval_threshold";

export interface DiscountApprovalThreshold {
  /** Decimal percentage, e.g. 15 for 15%. A quote's overall (blended) discount percentage at or above this requires owner approval. */
  percentage: number;
}

const DEFAULT_DISCOUNT_THRESHOLD: DiscountApprovalThreshold = { percentage: 20 };

interface ComputedLine {
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: bigint;
  unitPriceCurrency: string;
  discountPercentage: number;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  supplyClass: SupplyClass | null;
  hsnSac: string | null;
  lineSubtotalAmount: bigint;
  lineTaxAmount: bigint;
  lineTotalAmount: bigint;
}

interface ComputedTotals {
  lines: ComputedLine[];
  subtotalAmount: bigint;
  discountAmount: bigint;
  taxAmount: bigint;
  totalAmount: bigint;
  /** Blended discount as a percentage of the pre-discount subtotal, used against the approval threshold. 0 when the pre-discount subtotal is 0. */
  overallDiscountPercentage: number;
}

/**
 * Server-side computation of every line and document total from raw line
 * input — the ONLY place quote totals are computed. Never trust a
 * client-supplied total (CLAUDE.md). Uses `computeLineTax` (the existing
 * shared tax engine) per line. FEAT-08: a line's tax now resolves via
 * `TaxResolverService` from `taxRateId`/`taxGroupId` (real named rates,
 * multi-rate/compound-capable) when either is set, falling back to the
 * legacy flat `taxRatePercentage` otherwise — so pre-FEAT-08 callers (e.g.
 * a line with neither reference set) keep working unchanged.
 * `isTaxInclusive` is a per-line snapshot (S-08.2): when true, the line's
 * `unitPriceAmount` already includes tax and `computeLineTax` backs it out
 * instead of adding it on top.
 *
 * Discount is applied to the line's pre-tax amount before tax is computed
 * (tax is charged on the discounted price, the common convention) —
 * `lineSubtotalAmount` is the post-discount, pre-tax amount for an
 * exclusive line, or the post-discount inclusive amount for an inclusive
 * one; line quantity × unit price is rounded once at that point (half-up,
 * per CLAUDE.md), matching computeLineTax's own "round once, at line
 * level" rule. `heading`/`text` lines always compute to zero regardless of
 * what junk values are in their quantity/price/discount/tax fields, since
 * those fields are meaningless for non-`item` lines.
 */
async function computeQuoteTotals(
  orgId: string,
  currency: string,
  lines: CreateQuoteInput["lines"],
  taxResolver: TaxResolverService,
): Promise<ComputedTotals> {
  let subtotalAmount = 0n; // pre-discount
  let discountAmount = 0n;
  let taxAmount = 0n;
  let totalAmount = 0n;

  const computed: ComputedLine[] = await Promise.all(
    lines.map(async (line, index) => {
      if (line.type !== "item") {
        return {
          sortOrder: index,
          type: line.type,
          catalogItemId: line.catalogItemId ?? null,
          name: line.name,
          description: line.description ?? null,
          quantity: 0,
          unitPriceAmount: 0n,
          unitPriceCurrency: currency,
          discountPercentage: 0,
          taxRatePercentage: 0,
          taxRateId: null,
          taxGroupId: null,
          isTaxInclusive: false,
          supplyClass: null,
          hsnSac: null,
          lineSubtotalAmount: 0n,
          lineTaxAmount: 0n,
          lineTotalAmount: 0n,
        };
      }

      const resolved = line.taxRateId || line.taxGroupId
        ? await taxResolver.resolve(orgId, { taxRateId: line.taxRateId, taxGroupId: line.taxGroupId })
        : {
            rates: line.taxRatePercentage > 0 ? [{ id: "line", name: "Tax", percent: line.taxRatePercentage, isCompound: false }] : [],
            blendedPercentage: line.taxRatePercentage,
          };

      // US-TAX-11: an exempt or non-taxable line carries no tax.
      const supplyError = supplyClassTaxError(line.supplyClass, resolved.blendedPercentage);
      if (supplyError) throw new BadRequestException(supplyError);

      // US-TAX-07: exact decimal maths in @spine/shared, each figure rounded once.
      const computed = computeDocumentLine({
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        discountPercentage: line.discountPercentage,
        currency,
        rates: resolved.rates,
        inclusive: line.isTaxInclusive,
      });
      const { grossAmount, netAmount } = computed;
      const lineDiscountAmount = computed.discountAmount;
      const taxResult = computed.tax;

      subtotalAmount += grossAmount;
      discountAmount += lineDiscountAmount;
      taxAmount += taxResult.taxAmount.amount;
      totalAmount += taxResult.total.amount;

      return {
        sortOrder: index,
        type: "item" as const,
        catalogItemId: line.catalogItemId ?? null,
        name: line.name,
        description: line.description ?? null,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        // Always the document's own currency, never a client-supplied
        // per-line value — computeLineTax above already computed this line's
        // tax/total assuming `currency`, and v1 has no multi-currency support
        // (CLAUDE.md non-goals), so a line can never actually be priced in a
        // different currency than its own quote. Silently normalizing here
        // (rather than rejecting the request) matches this schema's existing
        // permissive-input, server-computes-the-truth convention.
        unitPriceCurrency: currency,
        discountPercentage: line.discountPercentage,
        taxRatePercentage: resolved.blendedPercentage,
        supplyClass: lineSupplyClass(resolved.blendedPercentage, line.supplyClass ?? ("supplyClass" in resolved ? resolved.supplyClass : null)),
        hsnSac: line.hsnSac ?? null,
        taxRateId: line.taxRateId ?? null,
        taxGroupId: line.taxGroupId ?? null,
        isTaxInclusive: line.isTaxInclusive,
        lineSubtotalAmount: netAmount,
        lineTaxAmount: taxResult.taxAmount.amount,
        lineTotalAmount: taxResult.total.amount,
      };
    }),
  );

  const overallDiscountPercentage = subtotalAmount > 0n ? (Number(discountAmount) / Number(subtotalAmount)) * 100 : 0;

  return { lines: computed, subtotalAmount, discountAmount, taxAmount, totalAmount, overallDiscountPercentage };
}

/**
 * PRD F3 Stage 1 — quote CRUD, line items, and versioning. PDF rendering,
 * email sending, the public accept/reject link, view/accept/reject event
 * tracking, owner notifications, and quote->job/invoice conversion are all
 * explicitly deferred to Stage 2/3 (see CHANGELOG). This service only
 * implements: draft CRUD, send (number allocation + immutability), revise
 * (versioning via parentQuoteId), and discount approval (S-03.9).
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly queue: QueueService,
    private readonly publicTokens: QuotePublicTokenService,
    private readonly taxResolver: TaxResolverService,
    private readonly placeOfSupply: PlaceOfSupplyService,
    private readonly notifications: NotificationsService,
    private readonly emailLog: EmailLogService,
  ) {}

  private async getThreshold(orgId: string): Promise<DiscountApprovalThreshold> {
    const value = await this.settings.get<DiscountApprovalThreshold>(orgId, DISCOUNT_THRESHOLD_KEY);
    return value ?? DEFAULT_DISCOUNT_THRESHOLD;
  }

  async list(orgId: string, options: { status?: string; contactId?: string; leadId?: string }) {
    const conditions = [eq(quotes.orgId, orgId)];
    if (options.contactId) conditions.push(eq(quotes.contactId, options.contactId));
    // US-CRM-26 — a lead's quotes, for the lead drawer.
    if (options.leadId) conditions.push(eq(quotes.leadId, options.leadId));

    const rows = await this.db
      .select({
        quote: quotes,
        contactName: contacts.name,
      })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(quotes.createdAt));

    // "Superseded" isn't a stored status (see quotes.ts's schema comment) —
    // derived here by checking whether any other quote's parentQuoteId
    // points back at this row.
    const supersededIds = new Set(
      rows.map((r) => r.quote.parentQuoteId).filter((id): id is string => Boolean(id)),
    );

    // rootQuoteId (item 4, user feedback) — walks each row's parentQuoteId
    // chain up to its version-1 ancestor, so the web list page can group
    // every version of "the same quote" together without reconstructing
    // the chain client-side. Computed here (over the already-fetched page
    // of rows, an in-memory Map lookup — not a recursive SQL CTE) since a
    // single org's quote count is small enough that this is cheap, and it
    // keeps QuotesService as the one place that understands versioning
    // topology, matching isSuperseded's own precedent just above.
    const byId = new Map(rows.map((r) => [r.quote.id, r.quote]));
    function resolveRootId(quoteId: string): string {
      let current = byId.get(quoteId);
      const seen = new Set<string>();
      while (current?.parentQuoteId && !seen.has(current.id)) {
        seen.add(current.id);
        const parent = byId.get(current.parentQuoteId);
        if (!parent) break; // parent outside this page/org — stop, current is the best-known root
        current = parent;
      }
      return current?.id ?? quoteId;
    }

    // US-QUO-29: how often the customer opened the link, and when last.
    const views = await this.db
      .select({ quoteId: quoteEvents.quoteId, viewCount: count(), lastViewedAt: max(quoteEvents.createdAt) })
      .from(quoteEvents)
      .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.type, "viewed")))
      .groupBy(quoteEvents.quoteId);
    const viewsById = new Map(views.map((v) => [v.quoteId, v]));
    // US-QUO-28: search covers the quotes' line names too.
    const lineRows = rows.length
      ? await this.db
          .select({ quoteId: quoteLines.quoteId, name: quoteLines.name })
          .from(quoteLines)
          .where(inArray(quoteLines.quoteId, rows.map((r) => r.quote.id)))
      : [];
    const lineNamesById = new Map<string, string[]>();
    for (const l of lineRows) lineNamesById.set(l.quoteId, [...(lineNamesById.get(l.quoteId) ?? []), l.name]);

    let result = rows.map((r) => ({
      ...r.quote,
      contactName: r.contactName,
      viewCount: Number(viewsById.get(r.quote.id)?.viewCount ?? 0),
      lastViewedAt: viewsById.get(r.quote.id)?.lastViewedAt ?? null,
      lineNames: lineNamesById.get(r.quote.id) ?? [],
      isExpired: isExpired(r.quote),
      isSuperseded: supersededIds.has(r.quote.id),
      rootQuoteId: resolveRootId(r.quote.id),
    }));

    if (options.status) {
      result = result.filter((q) => (options.status === "expired" ? q.isExpired : q.status === options.status));
    }

    return result;
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ quote: quotes, contactName: contacts.name })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!row) {
      throw new NotFoundException("Quote not found");
    }

    const lines = await this.db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id))
      .orderBy(quoteLines.sortOrder);

    const [supersededBy] = await this.db
      .select({ id: quotes.id, version: quotes.version })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.parentQuoteId, id)));

    return {
      ...row.quote,
      contactName: row.contactName,
      isExpired: isExpired(row.quote),
      isSuperseded: Boolean(supersededBy),
      supersededByQuoteId: supersededBy?.id ?? null,
      lines,
    };
  }

  /**
   * `GET /quotes/:id` — the quote, plus what reading it needs beyond the
   * row: the business as printed on the PDF (US-MOB-16's present screen),
   * its tax by named rate (US-MOB-16), and who recorded an on-site
   * response (US-QUO-20). Field reads only a quote they can present:
   * `sent`, on a job they're assigned to (404 otherwise, US-JOB-19).
   */
  async getDetail(orgId: string, userId: string, id: string) {
    const role = await getMemberRole(this.db, orgId, userId);
    if (role === "field" && !(await this.presentableByField(orgId, userId, id))) throw new NotFoundException("Quote not found");
    const quote = await this.getOne(orgId, id);
    if (role === "field" && quote.status !== "sent") throw new NotFoundException("Quote not found");
    return this.withDetail(orgId, quote);
  }

  private async withDetail(orgId: string, quote: Awaited<ReturnType<QuotesService["getOne"]>>) {
    const [business, book, acceptedBy] = await Promise.all([
      this.settings.get<QuotePdfBusinessProfile>(orgId, "business_profile"),
      RateBook.load(this.db, orgId, quote.lines),
      quote.acceptedByUserId ? this.db.select({ name: user.name }).from(user).where(eq(user.id, quote.acceptedByUserId)) : Promise.resolve([]),
    ]);
    return {
      ...quote,
      business: { name: business?.name || "Your business", address: business?.address || null },
      taxLines: book.taxLines(
        quote.lines.filter((l) => l.type === "item"),
        quote.supplyType,
      ),
      acceptedByName: acceptedBy[0]?.name ?? null,
    };
  }

  /** D-073 / US-MOB-16 — a quote a Field user may present: a variation order on, or the source quote of, a job they're assigned to. */
  private async presentableByField(orgId: string, userId: string, quoteId: string): Promise<boolean> {
    const [fromJobs, fromVariations] = await Promise.all([
      this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.sourceQuoteId, quoteId))),
      this.db.select({ id: jobVariationOrders.jobId }).from(jobVariationOrders).where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.quoteId, quoteId))),
    ]);
    const jobIds = [...fromJobs, ...fromVariations].map((r) => r.id);
    if (jobIds.length === 0) return false;
    const [assigned] = await this.db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.userId, userId), inArray(jobAssignments.jobId, jobIds)))
      .limit(1);
    return Boolean(assigned);
  }

  /** Field reaches only the quotes they can present — checked before any status check (07-security). */
  private async assertMayRespondInPerson(orgId: string, userId: string, quoteId: string) {
    const granted = await hasCapability(this.db, { orgId, userId }, "quotes.accept_in_person", true);
    if (!granted) throw new ForbiddenException("Missing capability: quotes.accept_in_person");
    const role = await getMemberRole(this.db, orgId, userId);
    if (role === "field" && !(await this.presentableByField(orgId, userId, quoteId))) throw new NotFoundException("Quote not found");
  }

  /**
   * `GET /quotes/:id/history` — confirms the quote exists (org-scoped)
   * before delegating to AuditLogService, same pattern as
   * InvoicesService.getHistory. Also surfaces the public-link
   * accept/reject events recorded by `PublicQuotesService.respond()`,
   * since those write to the same `audit_log` table with
   * `entityType: "quote"`. Repeat "viewed" events do NOT appear here —
   * those are logged to the separate `quote_events` table (see its own
   * schema doc comment), not `audit_log`, precisely because every single
   * view getting its own row in a document's own edit/status-change
   * history would be noise; this stays consistent with that design
   * rather than merging the two event streams.
   */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "quote", id);
  }

  /** Creates a new draft (version 1, no parent). Always unnumbered — see quotes.ts's schema comment. */
  /**
   * `isDemo` is not part of `CreateQuoteInput`/`createQuoteSchema` — it's
   * never client-settable (a real `POST /quotes` call can't mark its own
   * quote as demo data). It exists solely for `DemoDataService` to call
   * this same method directly (reusing real totals/threshold computation
   * and audit-log writes rather than duplicating that logic) instead of
   * hand-inserting rows, defaulting to `false` for every normal caller.
   */
  async create(orgId: string, actorUserId: string, input: CreateQuoteInput, isDemo = false) {
    return this.persistDraft(orgId, actorUserId, input, { parentQuoteId: null, version: 1 }, isDemo);
  }

  /**
   * Updates a DRAFT quote in place. A sent quote is immutable per
   * CLAUDE.md ("Issued financial documents are never edited or deleted") —
   * revising it means POST /quotes/:id/revise, which creates a new draft
   * version instead. `full-replace` on lines: the client always sends the
   * complete line array (matching Contacts' own nested contactPersons/
   * addresses full-replace convention), so this deletes and re-inserts all
   * lines rather than diffing them.
   */
  async update(orgId: string, id: string, actorUserId: string, input: UpdateQuoteInput) {
    const [existing] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!existing) {
      throw new NotFoundException("Quote not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "quotes.edit_own",
      others: "quotes.edit_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft quote can be edited. Revise it to create a new version instead.");
    }

    const currency = input.currency ?? existing.currency;
    const totals = input.lines !== undefined ? await computeQuoteTotals(orgId, currency, input.lines, this.taxResolver) : null;
    const threshold = await this.getThreshold(orgId);
    // US-TAX-13: a new contact (or a draft saved before GST was set up) takes the contact's place of supply.
    const supply = await this.placeOfSupply.resolve(
      orgId,
      input.contactId ?? existing.contactId,
      input.placeOfSupply !== undefined ? input.placeOfSupply : (input.contactId !== undefined && input.contactId !== existing.contactId) || existing.placeOfSupply === null ? undefined : existing.placeOfSupply,
      "sale",
    );

    // US-CRM-26: a lead set here must match the contact; changing the contact drops a lead that no longer does.
    const contactId = input.contactId ?? existing.contactId;
    let leadId: string | null | undefined;
    if (input.leadId) {
      await this.requireLead(orgId, input.leadId, contactId);
      leadId = input.leadId;
    } else if (input.leadId === null) {
      leadId = null;
    } else if (existing.leadId && contactId !== existing.contactId) {
      const [lead] = await this.db.select({ contactId: leads.contactId }).from(leads).where(eq(leads.id, existing.leadId));
      if (lead?.contactId !== contactId) leadId = null;
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(quotes)
        .set({
          placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType,
          ...(leadId !== undefined ? { leadId } : {}),
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.title !== undefined ? { title: input.title || null } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.termsAndConditions !== undefined ? { termsAndConditions: input.termsAndConditions } : {}),
          ...(totals
            ? {
                subtotalAmount: totals.subtotalAmount,
                discountAmount: totals.discountAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                discountRequiresApproval: totals.overallDiscountPercentage >= threshold.percentage,
                // A prior approval was only ever granted for the discount
                // percentage that existed at approval time — editing the
                // lines invalidates it regardless of which direction the
                // discount moved (even a lower discount changes what was
                // approved), so any edit to lines clears it and re-approval
                // is required before this draft can be sent again. Without
                // this, send()'s `discountRequiresApproval && !approvedByUserId`
                // check would let a quote ship with a discount an owner
                // never actually saw (S-03.9).
                approvedByUserId: null,
                approvedAt: null,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, id))
        .returning();

      if (input.lines !== undefined && totals) {
        await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id));
        await insertLines(tx, id, totals.lines);
      }

      // `lines` is destructured out before diffing — it isn't a real column
      // on `quotes` (so it always shows as a nonsensical "undefined -> [...]"
      // change), and it also carries bigint fields (unitPriceAmount) that
      // fail to JSON-serialize into audit_log.changes (a jsonb column),
      // exactly like Contacts' own update() excludes contactPersons/
      // addresses from its scalar-field diff for the same two reasons.
      const { lines: _lines, ...scalarInput } = input;
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, scalarInput as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "quote",
          entityId: id,
          contactId: row?.contactId ?? existing.contactId,
          changes,
        });
      }

      return row;
    });

    return this.getOne(orgId, updated!.id);
  }

  /**
   * Issues the quote: allocates its gapless number (via NumberingService,
   * inside this same transaction, per CLAUDE.md's numbering rule) and
   * flips status draft -> sent. Only a draft can be sent; sending is a
   * one-way transition (no "un-send").
   *
   * PRD F3 Stage 2 (S-03.4) hook point: after the transaction commits
   * (number allocated, status flipped — the irreversible, must-not-fail
   * part is already durable), this enqueues a `quote-send-email` pg-boss
   * job (QuoteEmailWorker) to render+persist the PDF and email it to the
   * contact. Enqueuing happens OUTSIDE the transaction and is not awaited
   * for its own completion — per CLAUDE.md's graceful-degradation rule
   * ("if SMTP is down, documents still issue and email queues for
   * retry"), a slow/failed SMTP send (or SMTP being unconfigured at all)
   * must never block or fail this request; pg-boss's own retry/backoff
   * (configured in QueueService.send) handles the email attempt entirely
   * out-of-band. If enqueuing itself throws (e.g. pg-boss's connection is
   * down), that's logged and swallowed here too, for the same reason —
   * the quote has already been irrevocably issued by this point and must
   * be returned as a success to the caller regardless.
   *
   * PRD F3 Stage 3 (S-03.5) hook point: mints a fresh public-quote token
   * (`QuotePublicTokenService.issue`) INSIDE the same transaction as the
   * number allocation/status flip — a token must never exist for a send
   * that ends up rolling back, exactly like the number itself. The token
   * string travels to the email worker via the queued job's own data
   * payload (not re-derived by the worker) so `QuoteEmailWorker` never
   * needs to know how tokens are minted — it just builds a link with
   * whatever token this method handed it.
   */
  async send(orgId: string, id: string, actorUserId: string, override?: EmailJobOverride) {
    const [preCheck] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Quote not found");
    }

    const { token } = await this.db.transaction(async (tx) => {
      // Re-select with a row lock inside the transaction — two concurrent
      // `send` calls on the same quote must not both pass the draft/
      // approval checks and both allocate a number (the first check above,
      // before the transaction opens, is only a fast-path existence check;
      // it cannot be trusted for the state guard below since it has no
      // lock and the row could change between it and here).
      const [existing] = await tx
        .select()
        .from(quotes)
        .where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Quote not found");
      }
      if (existing.status !== "draft") {
        throw new BadRequestException("Only a draft quote can be sent");
      }
      // D-154: with Approvals switched off, discounts need no approval.
      if (existing.discountRequiresApproval && !existing.approvedByUserId && (await moduleOn(tx, orgId, "approvals"))) {
        throw new BadRequestException("This quote's discount requires owner approval before it can be sent");
      }

      const number = await this.numbering.allocateNumber(tx, orgId, "quote", { demo: existing.isDemo });
      await tx
        .update(quotes)
        // emailStatus: "pending" here, not left null — the detail page
        // should show "sending…" immediately, not a blank/unknown state,
        // for the window between this commit and the queue worker actually
        // picking the job up. The worker (quote-email.worker.ts) owns every
        // subsequent transition to "sent"/"failed".
        .set({
          status: "sent",
          number,
          sentAt: new Date(),
          emailStatus: "pending",
          updatedAt: new Date(),
          // US-TAX-13: snapshotted when sent.
          ...(await this.placeOfSupply.resolve(orgId, existing.contactId, existing.placeOfSupply ?? undefined, "sale", tx)),
        })
        .where(eq(quotes.id, id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "sent",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "draft", to: "sent" }],
      });

      const issued = await this.publicTokens.issue(tx, orgId, id);
      return { token: issued.token };
    });

    try {
      await this.emailLog.enqueue(QUOTE_SEND_EMAIL_QUEUE, { orgId, quoteId: id, publicToken: token, ...(override ? { override } : {}) }, { orgId, kind: "quote", entityType: "quote", entityId: id, toAddress: override?.to, userId: actorUserId });
    } catch (err) {
      // Never let a queue-enqueue failure fail an already-committed send —
      // see this method's own doc comment above.
      this.logger.error(`Failed to enqueue quote-send-email job for quote ${id}`, err instanceof Error ? err.stack : String(err));
    }
    await queueIssuedPdf(this.queue, orgId, "quote", id);

    return this.getOne(orgId, id);
  }

  /**
   * S-03.8 — revises a SENT quote into a new draft version: copies every
   * line and field into a fresh row with `parentQuoteId` pointing at the
   * original and `version` incremented, without mutating the original at
   * all (its own row, including its number, stays exactly as issued). The
   * new version starts back at `status: "draft"` and `number: null` — it
   * must go through `send` again to get its own number, exactly like any
   * other draft. Only a `sent` (or `accepted`/`rejected`) quote can be
   * revised; revising a draft makes no sense (just edit it via PUT).
   */
  async revise(orgId: string, id: string, actorUserId: string) {
    const [preCheck] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Quote not found");
    }

    const revised = await this.db.transaction(async (tx) => {
      // Row-locked re-select + the supersession check both happen inside
      // this transaction, not before it — two concurrent `revise` calls on
      // the same quote must not both see "not yet superseded" and both
      // insert a competing next version. `quotes_parent_idx` is a plain
      // index (not unique), so nothing at the DB level blocks this either;
      // the lock here is the only guard.
      const [existing] = await tx
        .select()
        .from(quotes)
        .where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Quote not found");
      }
      if (existing.status === "draft") {
        throw new BadRequestException("A draft quote has no history to revise — edit it directly instead");
      }

      const [alreadySuperseded] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.orgId, orgId), eq(quotes.parentQuoteId, id)));
      if (alreadySuperseded) {
        throw new BadRequestException("This quote has already been revised into a newer version");
      }

      const existingLines = await tx.select().from(quoteLines).where(eq(quoteLines.quoteId, id)).orderBy(quoteLines.sortOrder);

      const [row] = await tx
        .insert(quotes)
        .values({
          orgId,
          contactId: existing.contactId,
          title: existing.title,
          status: "draft",
          parentQuoteId: existing.id,
          version: existing.version + 1,
          validUntil: existing.validUntil,
          currency: existing.currency,
          subtotalAmount: existing.subtotalAmount,
          discountAmount: existing.discountAmount,
          taxAmount: existing.taxAmount,
          totalAmount: existing.totalAmount,
          discountRequiresApproval: existing.discountRequiresApproval,
          notes: existing.notes,
          termsAndConditions: existing.termsAndConditions,
          createdByUserId: actorUserId,
          placeOfSupply: existing.placeOfSupply,
          supplyType: existing.supplyType,
          leadId: existing.leadId,
          // A revision of a demo quote must itself be demo data — otherwise
          // it would survive DemoDataService.deleteAll's isDemo-scoped
          // cleanup as an orphaned real-looking row.
          isDemo: existing.isDemo,
        })
        .returning();

      if (existingLines.length) {
        await tx.insert(quoteLines).values(
          existingLines.map((line) => ({
            quoteId: row!.id,
            sortOrder: line.sortOrder,
            type: line.type,
            catalogItemId: line.catalogItemId,
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unitPriceAmount: line.unitPriceAmount,
            unitPriceCurrency: line.unitPriceCurrency,
            discountPercentage: line.discountPercentage,
            taxRatePercentage: line.taxRatePercentage,
            taxRateId: line.taxRateId,
            taxGroupId: line.taxGroupId,
            isTaxInclusive: line.isTaxInclusive,
            supplyClass: line.supplyClass,
            hsnSac: line.hsnSac,
            lineSubtotalAmount: line.lineSubtotalAmount,
            lineTaxAmount: line.lineTaxAmount,
            lineTotalAmount: line.lineTotalAmount,
          })),
        );
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "revised",
        entityType: "quote",
        entityId: row!.id,
        contactId: existing.contactId,
        changes: [{ field: "parentQuoteId", from: null, to: existing.id }],
      });

      // A revised quote's prior version is now superseded — its old public
      // link must stop working (a customer opening a stale emailed link
      // should never be able to accept/view pricing that's no longer
      // current). See QuotePublicTokenService's own doc comment on why
      // tokens are reusable-until-resolved rather than one-time-use; being
      // superseded is one of the resolutions that ends a token's life.
      await this.publicTokens.revokeAllForQuote(tx, existing.id);

      return row;
    });

    return this.getOne(orgId, revised!.id);
  }

  /**
   * US-QUO-24 (D-096) — a new draft from any quote: same contact, lines,
   * notes and terms, with the lines' own snapshot prices and tax (never
   * re-read from the catalogue). It isn't a revision (no parent, version 1,
   * no number) and gets a fresh validity date: today plus the original's
   * validity period, or 30 days when it had none. History opens with
   * "Duplicated from <number>".
   */
  async duplicate(orgId: string, id: string, actorUserId: string) {
    const [source] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!source) throw new NotFoundException("Quote not found");
    const sourceLines = await this.db.select().from(quoteLines).where(eq(quoteLines.quoteId, id)).orderBy(quoteLines.sortOrder);

    const DAY = 24 * 60 * 60 * 1000;
    const start = source.sentAt ?? source.createdAt;
    // US-QUO-36: with no validity on the original, the business's usual period.
    const layout = await this.settings.get<DocumentLayout>(orgId, "document_layout").catch(() => null);
    const periodDays = source.validUntil ? Math.max(1, Math.round((new Date(source.validUntil).getTime() - new Date(start).getTime()) / DAY)) : resolveDocumentLayout(layout, "quote").validDays;
    const validUntil = new Date(Date.now() + periodDays * DAY);

    const copy = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(quotes)
        .values({
          orgId,
          contactId: source.contactId,
          title: source.title,
          status: "draft",
          parentQuoteId: null,
          version: 1,
          validUntil,
          currency: source.currency,
          subtotalAmount: source.subtotalAmount,
          discountAmount: source.discountAmount,
          taxAmount: source.taxAmount,
          totalAmount: source.totalAmount,
          discountRequiresApproval: source.discountRequiresApproval,
          notes: source.notes,
          termsAndConditions: source.termsAndConditions,
          createdByUserId: actorUserId,
          isDemo: source.isDemo,
          placeOfSupply: source.placeOfSupply,
          supplyType: source.supplyType,
        })
        .returning();
      if (sourceLines.length) {
        await tx.insert(quoteLines).values(
          sourceLines.map((line) => ({
            quoteId: row!.id,
            sortOrder: line.sortOrder,
            type: line.type,
            catalogItemId: line.catalogItemId,
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unitPriceAmount: line.unitPriceAmount,
            unitPriceCurrency: line.unitPriceCurrency,
            discountPercentage: line.discountPercentage,
            taxRatePercentage: line.taxRatePercentage,
            taxRateId: line.taxRateId,
            taxGroupId: line.taxGroupId,
            isTaxInclusive: line.isTaxInclusive,
            supplyClass: line.supplyClass,
            hsnSac: line.hsnSac,
            lineSubtotalAmount: line.lineSubtotalAmount,
            lineTaxAmount: line.lineTaxAmount,
            lineTotalAmount: line.lineTotalAmount,
          })),
        );
      }
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "duplicated",
        entityType: "quote",
        entityId: row!.id,
        contactId: source.contactId,
        changes: [{ field: "duplicatedFrom", from: null, to: source.number ?? `draft v${source.version}` }],
      });
      return row!;
    });
    return this.getOne(orgId, copy.id);
  }

  /**
   * US-QUO-24 — "Email again" for a sent quote: queues the same quote email
   * with a fresh public link. Earlier links keep working (US-QUO-22); the
   * PDF is the one stored when it was sent (US-INV-17).
   */
  async resend(orgId: string, id: string, actorUserId: string, override?: EmailJobOverride) {
    const { token } = await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id))).for("update");
      if (!existing) throw new NotFoundException("Quote not found");
      if (existing.status !== "sent") throw new BadRequestException("Only a sent quote can be emailed again.");
      await tx.update(quotes).set({ emailStatus: "pending", emailError: null, updatedAt: new Date() }).where(eq(quotes.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "email_queued",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [],
      });
      return this.publicTokens.issue(tx, orgId, id);
    });
    try {
      await this.emailLog.enqueue(QUOTE_SEND_EMAIL_QUEUE, { orgId, quoteId: id, publicToken: token, ...(override ? { override } : {}) }, { orgId, kind: "quote", entityType: "quote", entityId: id, toAddress: override?.to, userId: actorUserId });
    } catch (err) {
      this.logger.error(`Failed to enqueue quote-send-email job for quote ${id}`, err instanceof Error ? err.stack : String(err));
    }
    return this.getOne(orgId, id);
  }

  /**
   * US-QUO-35 (D-214) — "Preview PDF" in the builder: the PDF of the quote
   * as it is on screen, saved or not. Nothing is written: totals, tax and
   * the place of supply are worked out exactly as a save would, then
   * rendered from memory. `quoteId` (an existing draft) keeps its version
   * and dates.
   */
  async previewDraft(orgId: string, actorUserId: string, input: CreateQuoteInput, quoteId?: string) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) throw new BadRequestException("Contact not found");
    const [existing] = quoteId ? await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId))) : [];
    if (quoteId && !existing) throw new NotFoundException("Quote not found");

    const totals = await computeQuoteTotals(orgId, input.currency, input.lines, this.taxResolver);
    const supply = await this.placeOfSupply.resolve(orgId, input.contactId, input.placeOfSupply, "sale");
    const now = new Date();
    const id = existing?.id ?? "00000000-0000-0000-0000-000000000000";
    const quote: typeof quotes.$inferSelect = {
      id,
      orgId,
      contactId: input.contactId,
      number: existing?.number ?? null,
      title: input.title || null,
      status: "draft",
      parentQuoteId: existing?.parentQuoteId ?? null,
      version: existing?.version ?? 1,
      validUntil: input.validUntil ?? null,
      currency: input.currency,
      subtotalAmount: totals.subtotalAmount,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      discountRequiresApproval: false,
      approvedByUserId: null,
      approvedAt: null,
      notes: input.notes ?? null,
      termsAndConditions: input.termsAndConditions ?? null,
      createdByUserId: existing?.createdByUserId ?? actorUserId,
      sentAt: null,
      respondedAt: null,
      responseComment: null,
      acceptanceMethod: null,
      acceptedByUserId: null,
      signatureFileId: null,
      acceptedSignerName: null,
      issuedPdfFileId: null,
      emailStatus: null,
      emailError: null,
      emailSentAt: null,
      isDemo: false,
      placeOfSupply: supply.placeOfSupply,
      supplyType: supply.supplyType,
      leadId: input.leadId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const lines = totals.lines.map((line, index) => ({ ...line, id: `preview-${index}`, quoteId: id })) as (typeof quoteLines.$inferSelect)[];
    return { quote, lines, contactName: contact.name, contactEmail: contact.email };
  }

  /**
   * US-QUO-31 (D-214) — "Copy customer link": a fresh link to the
   * customer's page, as an emailed one, with nothing emailed. Earlier links
   * keep working (US-QUO-22). Only a sent quote that hasn't been revised.
   */
  async link(orgId: string, id: string, actorUserId: string): Promise<QuoteCustomerLink> {
    const issued = await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id))).for("update");
      if (!existing) throw new NotFoundException("Quote not found");
      const [newer] = await tx.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.parentQuoteId, id)));
      if (existing.status !== "sent" || newer) throw new BadRequestException(QUOTE_NO_LINK);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "link_copied", entityType: "quote", entityId: id, contactId: existing.contactId, changes: [] });
      return this.publicTokens.issue(tx, orgId, id);
    });
    return { url: appUrl(`/quote/${issued.token}`), expiresAt: issued.expiresAt.toISOString() };
  }

  /**
   * US-QUO-32 (D-214) — the quote's story for its Activity panel, newest
   * first: its audit entries, the customer's views and answers
   * (`quote_events`), its email status, and the invoices and jobs made
   * from it. "View history" keeps the field-level changes.
   */
  async activity(orgId: string, id: string): Promise<QuoteActivityEntry[]> {
    const quote = await this.getOne(orgId, id);
    const entries: QuoteActivityEntry[] = [];
    const iso = (d: Date | string) => new Date(d).toISOString();

    for (const row of await this.auditLog.listForEntity(orgId, "quote", id)) {
      const actorName = row.actorName ?? null;
      const changes = (row.changes ?? []) as { field: string; from: unknown; to: unknown }[];
      switch (row.action) {
        case "created":
          entries.push({ at: iso(row.createdAt), type: "created", actorName, detail: null });
          break;
        case "updated":
          entries.push({ at: iso(row.createdAt), type: "edited", actorName, detail: null });
          break;
        case "sent":
          entries.push({ at: iso(row.createdAt), type: "sent", actorName, detail: null });
          break;
        case "discount_approved":
          entries.push({ at: iso(row.createdAt), type: "discount_approved", actorName, detail: null });
          break;
        case "link_copied":
          entries.push({ at: iso(row.createdAt), type: "link_copied", actorName, detail: null });
          break;
        case "duplicated":
          entries.push({ at: iso(row.createdAt), type: "duplicated", actorName, detail: String(changes.find((c) => c.field === "duplicatedFrom")?.to ?? "") || null });
          break;
        case "revised":
          entries.push({ at: iso(row.createdAt), type: "revised", actorName, detail: quote.parentQuoteId ? `v${quote.version - 1}` : null, linkId: quote.parentQuoteId });
          break;
        case "accepted_in_person":
          entries.push({ at: iso(row.createdAt), type: "accepted", actorName, detail: quote.responseComment ?? null, method: "in_person" });
          break;
        case "rejected_in_person":
          entries.push({ at: iso(row.createdAt), type: "rejected", actorName, detail: quote.responseComment ?? null, method: "in_person" });
          break;
        default:
          break;
      }
    }

    const events = await this.db
      .select({ type: quoteEvents.type, comment: quoteEvents.comment, createdAt: quoteEvents.createdAt })
      .from(quoteEvents)
      .where(and(eq(quoteEvents.orgId, orgId), eq(quoteEvents.quoteId, id)));
    for (const ev of events) {
      if (ev.type === "viewed") entries.push({ at: iso(ev.createdAt), type: "viewed", actorName: null, detail: null });
      else entries.push({ at: iso(ev.createdAt), type: ev.type, actorName: quote.contactName ?? null, detail: ev.comment ?? null, method: "public_link" });
    }

    if (quote.emailStatus === "sent" && quote.emailSentAt) {
      const [contact] = await this.db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, quote.contactId));
      entries.push({ at: iso(quote.emailSentAt), type: "emailed", actorName: null, detail: contact?.email ?? null });
    } else if (quote.emailStatus === "failed") {
      entries.push({ at: iso(quote.updatedAt), type: "email_failed", actorName: null, detail: quote.emailError ?? null });
    }

    const made = await this.madeFrom(orgId, [id]);
    for (const inv of made.invoices) entries.push({ at: iso(inv.createdAt), type: "converted_to_invoice", actorName: inv.actorName, detail: inv.number, linkId: inv.id });
    for (const job of made.jobs) entries.push({ at: iso(job.createdAt), type: "converted_to_job", actorName: job.actorName, detail: job.number ?? job.name, linkId: job.id });

    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** The invoices and jobs made from any of these quotes (no jobs while Jobs & field is off). */
  private async madeFrom(orgId: string, quoteIds: string[]) {
    const invoiceRows = await this.db
      .select({ id: invoices.id, number: invoices.number, status: invoices.status, createdAt: invoices.createdAt, actorName: user.name })
      .from(invoices)
      .leftJoin(user, eq(invoices.createdByUserId, user.id))
      .where(and(eq(invoices.orgId, orgId), inArray(invoices.sourceQuoteId, quoteIds)))
      .orderBy(invoices.createdAt);
    const jobRows = (await moduleOn(this.db, orgId, "jobsField"))
      ? await this.db
          .select({ id: jobs.id, number: jobs.number, name: jobs.name, status: jobs.status, createdAt: jobs.createdAt, actorName: user.name })
          .from(jobs)
          .leftJoin(user, eq(jobs.createdByUserId, user.id))
          .where(and(eq(jobs.orgId, orgId), inArray(jobs.sourceQuoteId, quoteIds)))
          .orderBy(jobs.createdAt)
      : [];
    return {
      invoices: invoiceRows.map((r) => ({ ...r, actorName: r.actorName ?? null })),
      jobs: jobRows.map((r) => ({ ...r, actorName: r.actorName ?? null })),
    };
  }

  /**
   * US-QUO-33 (D-214) — what a quote is connected to: the lead it's for,
   * every version of it, and the jobs and invoices made from any version.
   */
  async related(orgId: string, id: string): Promise<QuoteRelated> {
    const quote = await this.getOne(orgId, id);
    const family = await this.db
      .select({ id: quotes.id, parentQuoteId: quotes.parentQuoteId, version: quotes.version, number: quotes.number, status: quotes.status, validUntil: quotes.validUntil, createdAt: quotes.createdAt, leadId: quotes.leadId })
      .from(quotes)
      .where(and(eq(quotes.orgId, orgId), eq(quotes.contactId, quote.contactId)));
    // Walk up to the first version, then collect everything descended from it.
    const byId = new Map(family.map((q) => [q.id, q]));
    let root = byId.get(id)!;
    const seen = new Set<string>();
    while (root.parentQuoteId && byId.has(root.parentQuoteId) && !seen.has(root.id)) {
      seen.add(root.id);
      root = byId.get(root.parentQuoteId)!;
    }
    const versions = [root];
    for (let i = 0; i < versions.length; i++) {
      for (const q of family) if (q.parentQuoteId === versions[i]!.id) versions.push(q);
    }
    versions.sort((a, b) => a.version - b.version);

    const leadId = quote.leadId ?? versions.find((v) => v.leadId)?.leadId ?? null;
    const [lead] = leadId ? await this.db.select({ id: leads.id, title: leads.title }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId))) : [];
    const made = await this.madeFrom(orgId, versions.map((v) => v.id));
    return {
      lead: lead ?? null,
      versions: versions.map((v) => ({ id: v.id, version: v.version, number: v.number, status: v.status, isExpired: isExpired(v), createdAt: v.createdAt.toISOString() })),
      jobs: made.jobs.map((j) => ({ id: j.id, number: j.number, name: j.name, status: j.status })),
      invoices: made.invoices.map((i) => ({ id: i.id, number: i.number, status: i.status })),
    };
  }

  /**
   * S-03.9 — owner approves a quote whose blended discount met/exceeded the
   * org's threshold. Owner-only, enforced via `@OrgRoles(["owner"])` on the
   * controller route (server-side authorization per CLAUDE.md — the role
   * check happens before this method is ever invoked, so it isn't repeated
   * here). Meaningful on a draft (approval happens before send; `send()`
   * itself blocks if a quote needs approval it hasn't received yet).
   */
  async approveDiscount(orgId: string, id: string, actorUserId: string) {
    const [preCheck] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Quote not found");
    }

    const updated = await this.db.transaction(async (tx) => {
      // Locked re-select, same reasoning as send()/revise() — two
      // concurrent approvals must not both record a "discount_approved"
      // audit entry for what should be a single approval event.
      const [existing] = await tx
        .select()
        .from(quotes)
        .where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Quote not found");
      }
      if (!existing.discountRequiresApproval) {
        throw new BadRequestException("This quote's discount does not require approval");
      }
      if (existing.approvedByUserId) {
        throw new BadRequestException("This quote's discount has already been approved");
      }

      const [row] = await tx
        .update(quotes)
        .set({ approvedByUserId: actorUserId, approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "discount_approved",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "approvedByUserId", from: null, to: actorUserId }],
      });

      return row;
    });

    return this.getOne(orgId, updated!.id);
  }

  /** A draft can be hard-deleted — nothing references it yet (no ledger, no PDF, no email sent). A sent/accepted/rejected quote can never be deleted, only stay in its status, matching CLAUDE.md's "issued financial documents are never edited or deleted." */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!existing) {
      throw new NotFoundException("Quote not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "quotes.delete_own",
      others: "quotes.delete_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft quote can be deleted");
    }

    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: existing.status, to: null }],
      });
      await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id));
      await tx.delete(quotes).where(eq(quotes.id, id));
    });
    return { id };
  }

  /**
   * Phase 5 (Mobile, S-11.7) — `POST /quotes/:id/accept-in-person`. An
   * authenticated Owner/Staff/Field user, inside the app, captures the
   * customer's on-site signature and resolves the quote to `accepted` on
   * their behalf. Deliberately a SEPARATE code path from
   * `PublicQuotesService.respond` rather than that service with a session
   * bolted on: the public path is architecturally token-only and
   * unauthenticated by design (`@Public()`, no `@Session()` read anywhere
   * in that service, `RequestProvenance` is IP+user-agent only, no actor
   * concept at all) — reusing it here would mean smuggling an authenticated
   * actor through a code path built specifically to have none, and the
   * audit trail needs a genuinely different fact recorded (`acceptedByUserId`
   * + `acceptanceMethod: "in_person"`, which the public path's schema has
   * no column for and should never set). Both paths still leave the quote
   * in the identical terminal `status: "accepted"` state and both fire the
   * same "quote accepted" owner notification + variation-order nudge, so
   * duplicating that small tail (not the whole state machine) here is a
   * deliberate, bounded amount of overlap in exchange for keeping the
   * public flow's "no session, ever" invariant airtight.
   *
   * `quotes.accept_in_person` gates this — Field always passes it
   * (`FIELD_ALWAYS_CAPABILITIES`, since this is the entire point of S-11.7
   * and was never an ownership question), Owner bypasses via
   * `hasCapability`'s existing role check, Staff needs the Team grant.
   * Checked directly via `hasCapability`, not `requireOwnershipCapability`
   * — there's no own/others dimension to "did I capture this signature,"
   * only "am I allowed to."
   */
  async acceptInPerson(orgId: string, id: string, actorUserId: string, input: z.infer<typeof acceptQuoteInPersonSchema>) {
    await this.assertMayRespondInPerson(orgId, actorUserId, id);

    // US-QUO-19: the signature is an image this user just uploaded, in this organisation.
    const [signatureFile] = await this.db
      .select({ id: files.id, mimeType: files.mimeType })
      .from(files)
      .where(and(eq(files.orgId, orgId), eq(files.id, input.signatureFileId), eq(files.uploadedByUserId, actorUserId)));
    if (!signatureFile) {
      throw new BadRequestException("Signature file not found");
    }
    if (!signatureFile.mimeType.startsWith("image/")) {
      throw new BadRequestException("The signature must be an image.");
    }

    const [preCheck] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Quote not found");
    }

    const respondedAt = new Date();

    await this.db.transaction(async (tx) => {
      // Row-locked re-select, same concurrency discipline as send()/revise()
      // above and PublicQuotesService.respond — an in-person accept racing a
      // customer's own public-link accept (or a second in-person attempt)
      // must not both succeed.
      const [existing] = await tx.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id))).for("update");
      if (!existing) {
        throw new NotFoundException("Quote not found");
      }
      if (existing.status !== "sent") {
        throw new GoneException(
          existing.status === "accepted" || existing.status === "rejected"
            ? `This quote has already been ${existing.status}`
            : "This quote is not currently open for a response",
        );
      }

      await tx
        .update(quotes)
        .set({
          status: "accepted",
          respondedAt,
          responseComment: input.comment ?? null,
          acceptanceMethod: "in_person",
          acceptedByUserId: actorUserId,
          signatureFileId: signatureFile.id,
          acceptedSignerName: input.signerName,
          updatedAt: respondedAt,
        })
        .where(eq(quotes.id, id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "accepted_in_person",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [
          { field: "status", from: "sent", to: "accepted" },
          { field: "signedBy", from: null, to: input.signerName },
        ],
      });
    });

    const updated = await this.withDetail(orgId, await this.getOne(orgId, id));

    const business = await this.settings.get<QuotePdfBusinessProfile>(orgId, "business_profile");
    const businessName = business?.name || "Your business";

    void this.notifications.notify(orgId, {
      subject: `Quote ${updated.number ?? ""} accepted in person`.trim(),
      text: `Quote ${updated.number ?? ""} was accepted in person on ${businessName}.`,
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "quote_accepted",
        message: `Quote ${updated.number ?? "your quote"} was accepted in person.`,
        link: `/quotes/${updated.id}`,
      },
    });
    await this.nudgeVariationOrder(orgId, updated, businessName);

    return updated;
  }

  /**
   * US-MOB-16 — `POST /quotes/:id/reject-in-person`: the customer declines
   * on site, with an optional reason. Needs a connection like accepting
   * (D-050). Same checks as `acceptInPerson`; the office is told straight
   * away.
   */
  async rejectInPerson(orgId: string, id: string, actorUserId: string, input: z.infer<typeof rejectQuoteInPersonSchema>) {
    await this.assertMayRespondInPerson(orgId, actorUserId, id);
    const respondedAt = new Date();
    const comment = input.comment?.trim() || null;

    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id))).for("update");
      if (!existing) throw new NotFoundException("Quote not found");
      if (existing.status !== "sent") {
        throw new GoneException(
          existing.status === "accepted" || existing.status === "rejected" ? `This quote has already been ${existing.status}` : "This quote is not currently open for a response",
        );
      }
      await tx
        .update(quotes)
        .set({ status: "rejected", respondedAt, responseComment: comment, acceptanceMethod: "in_person", acceptedByUserId: actorUserId, updatedAt: respondedAt })
        .where(eq(quotes.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "rejected_in_person",
        entityType: "quote",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "sent", to: "rejected" }, ...(comment ? [{ field: "reason", from: null, to: comment }] : [])],
      });
    });

    const updated = await this.withDetail(orgId, await this.getOne(orgId, id));
    void this.notifications.notify(orgId, {
      subject: `Quote ${updated.number ?? ""} declined in person`.trim(),
      text: [`Quote ${updated.number ?? ""} was declined in person on ${updated.business.name}.`, comment ? `\nTheir reason: "${comment}"` : ""].join("\n"),
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "quote_rejected",
        message: `Quote ${updated.number ?? "your quote"} was declined in person.`,
        link: `/quotes/${updated.id}`,
      },
    });
    return updated;
  }

  /** S-04.9 — an accepted variation order's quote: ask the office to apply it to the job (same nudge as the public link). */
  private async nudgeVariationOrder(orgId: string, quote: { id: string; number: string | null; contactName: string | null }, businessName: string) {
    const [variation] = await this.db
      .select({ jobId: jobVariationOrders.jobId })
      .from(jobVariationOrders)
      .where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.quoteId, quote.id)));
    if (!variation) return;
    void this.notifications.notify(orgId, {
      subject: `Variation order accepted — ready to apply to job`,
      text: `${quote.contactName ?? "Your customer"} accepted variation order ${quote.number ?? ""} on ${businessName}. Review it and apply it to the job to update the contract value.`,
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "variation_order_accepted",
        message: `${quote.contactName ?? "Your customer"} accepted variation order ${quote.number ?? ""} — apply it to the job.`,
        link: `/jobs/${variation.jobId}?tab=variations`,
      },
    });
  }

  /** US-CRM-26 — a quote's lead must be in the same organisation and for the same contact. */
  private async requireLead(orgId: string, leadId: string, contactId: string) {
    const [lead] = await this.db.select({ contactId: leads.contactId }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, leadId)));
    if (!lead || lead.contactId !== contactId) throw new BadRequestException("Choose a lead for this contact.");
  }

  private async persistDraft(
    orgId: string,
    actorUserId: string,
    input: CreateQuoteInput,
    versioning: { parentQuoteId: string | null; version: number },
    isDemo = false,
  ) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    if (input.leadId) await this.requireLead(orgId, input.leadId, input.contactId);

    const totals = await computeQuoteTotals(orgId, input.currency, input.lines, this.taxResolver);
    const threshold = await this.getThreshold(orgId);
    // US-TAX-13: the place of supply given, else the contact's.
    const supply = await this.placeOfSupply.resolve(orgId, input.contactId, input.placeOfSupply, "sale");

    const created = await this.db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(quotes)
        .values({
          orgId,
          contactId: input.contactId,
          title: input.title || null,
          status: "draft",
          parentQuoteId: versioning.parentQuoteId,
          version: versioning.version,
          validUntil: input.validUntil ?? null,
          currency: input.currency,
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          discountRequiresApproval: totals.overallDiscountPercentage >= threshold.percentage,
          notes: input.notes ?? null,
          termsAndConditions: input.termsAndConditions ?? null,
          createdByUserId: actorUserId,
          isDemo,
          placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType,
          leadId: input.leadId ?? null,
        })
        .returning();

      await insertLines(tx, quote!.id, totals.lines);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "quote",
        entityId: quote!.id,
        contactId: input.contactId,
        changes: [{ field: "status", from: null, to: "draft" }],
      });

      return quote;
    });

    return this.getOne(orgId, created!.id);
  }
}

async function insertLines(tx: Transaction, quoteId: string, lines: ComputedLine[]) {
  if (!lines.length) return;
  await tx.insert(quoteLines).values(
    lines.map((line) => ({
      quoteId,
      sortOrder: line.sortOrder,
      type: line.type,
      catalogItemId: line.catalogItemId,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPriceAmount: line.unitPriceAmount,
      unitPriceCurrency: line.unitPriceCurrency,
      discountPercentage: line.discountPercentage,
      taxRatePercentage: line.taxRatePercentage,
      taxRateId: line.taxRateId,
      taxGroupId: line.taxGroupId,
      isTaxInclusive: line.isTaxInclusive,
      supplyClass: line.supplyClass,
      hsnSac: line.hsnSac,
      lineSubtotalAmount: line.lineSubtotalAmount,
      lineTaxAmount: line.lineTaxAmount,
      lineTotalAmount: line.lineTotalAmount,
    })),
  );
}

/**
 * S-03.11 — "expired" is computed, not stored (see quotes.ts's schema
 * comment for the full reasoning). Only a `sent` quote can be expired — a
 * draft has no customer-facing validity yet, and accepted/rejected are
 * terminal states that expiry shouldn't override.
 */
function isExpired(quote: Pick<typeof quotes.$inferSelect, "status" | "validUntil">): boolean {
  if (quote.status !== "sent" || !quote.validUntil) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = new Date(quote.validUntil);
  validUntil.setHours(0, 0, 0, 0);
  return validUntil < today;
}
