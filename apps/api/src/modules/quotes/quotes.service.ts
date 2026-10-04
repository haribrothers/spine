import { BadRequestException, ForbiddenException, GoneException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { acceptQuoteInPersonSchema, createQuoteSchema, updateQuoteSchema } from "@spine/shared";
import { computeDocumentLine } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { quotes, quoteLines, contacts, files } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { hasCapability, requireOwnershipCapability } from "../../auth/capability.util";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { QueueService } from "../queue/queue.service";
import { queueIssuedPdf } from "../pdf/issued-pdf.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { QuotePdfBusinessProfile } from "../pdf/quote-pdf.template";
import { QUOTE_SEND_EMAIL_QUEUE } from "./quote-email.worker";
import { QuotePublicTokenService } from "./quote-public-token.service";

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
    private readonly notifications: NotificationsService,
  ) {}

  private async getThreshold(orgId: string): Promise<DiscountApprovalThreshold> {
    const value = await this.settings.get<DiscountApprovalThreshold>(orgId, DISCOUNT_THRESHOLD_KEY);
    return value ?? DEFAULT_DISCOUNT_THRESHOLD;
  }

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const conditions = [eq(quotes.orgId, orgId)];
    if (options.contactId) conditions.push(eq(quotes.contactId, options.contactId));

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

    let result = rows.map((r) => ({
      ...r.quote,
      contactName: r.contactName,
      isExpired: isExpired(r.quote),
      isSuperseded: supersededIds.has(r.quote.id),
      rootQuoteId: resolveRootId(r.quote.id),
    }));

    if (options.status) {
      result = result.filter((q) => (options.status === "expired" ? q.isExpired : q.status === options.status));
    }

    return result;
  }

  /**
   * Item 7 (user feedback) — joins pg-boss's own pending-job rows (from
   * `QueueService.listPendingJobs`, already org-scoped) against `quotes`
   * for display (quote number, contact name) — the job's own `data` blob
   * only carries `quoteId`, nothing human-readable.
   */
  async enrichEmailQueueJobs(orgId: string, jobs: { id: string; data: unknown; state: string; retryCount: number; retryLimit: number; createdOn: Date; startAfter: Date }[]) {
    const quoteIds = jobs
      .map((job) => (job.data as { quoteId?: string } | null)?.quoteId)
      .filter((id): id is string => Boolean(id));
    if (!quoteIds.length) return [];

    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, contactName: contacts.name })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(eq(quotes.orgId, orgId));
    const byId = new Map(rows.map((r) => [r.id, r]));

    return jobs
      .map((job) => {
        const quoteId = (job.data as { quoteId?: string } | null)?.quoteId;
        const quote = quoteId ? byId.get(quoteId) : undefined;
        if (!quote) return null; // job for a quote outside this org, or since deleted
        return {
          jobId: job.id,
          quoteId: quote.id,
          quoteNumber: quote.number,
          contactName: quote.contactName,
          state: job.state,
          retryCount: job.retryCount,
          retryLimit: job.retryLimit,
          createdOn: job.createdOn,
          startAfter: job.startAfter,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
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

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(quotes)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
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
  async send(orgId: string, id: string, actorUserId: string) {
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
      if (existing.discountRequiresApproval && !existing.approvedByUserId) {
        throw new BadRequestException("This quote's discount requires owner approval before it can be sent");
      }

      const number = await this.numbering.allocateNumber(tx, orgId, "quote");
      await tx
        .update(quotes)
        // emailStatus: "pending" here, not left null — the detail page
        // should show "sending…" immediately, not a blank/unknown state,
        // for the window between this commit and the queue worker actually
        // picking the job up. The worker (quote-email.worker.ts) owns every
        // subsequent transition to "sent"/"failed".
        .set({ status: "sent", number, sentAt: new Date(), emailStatus: "pending", updatedAt: new Date() })
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
      await this.queue.send(QUOTE_SEND_EMAIL_QUEUE, { orgId, quoteId: id, publicToken: token });
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
    const granted = await hasCapability(this.db, { orgId, userId: actorUserId }, "quotes.accept_in_person", true);
    if (!granted) {
      throw new ForbiddenException("Missing capability: quotes.accept_in_person");
    }

    const [signatureFile] = await this.db.select({ id: files.id }).from(files).where(and(eq(files.orgId, orgId), eq(files.id, input.signatureFileId)));
    if (!signatureFile) {
      throw new BadRequestException("Signature file not found");
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
        changes: [{ field: "status", from: "sent", to: "accepted" }],
      });
    });

    const updated = await this.getOne(orgId, id);

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

    return updated;
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

    const totals = await computeQuoteTotals(orgId, input.currency, input.lines, this.taxResolver);
    const threshold = await this.getThreshold(orgId);

    const created = await this.db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(quotes)
        .values({
          orgId,
          contactId: input.contactId,
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
function isExpired(quote: typeof quotes.$inferSelect): boolean {
  if (quote.status !== "sent" || !quote.validUntil) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validUntil = new Date(quote.validUntil);
  validUntil.setHours(0, 0, 0, 0);
  return validUntil < today;
}
