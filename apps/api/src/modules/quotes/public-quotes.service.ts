import { GoneException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { parse } from "node-html-parser";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { quotes, quoteLines, quoteEvents, contacts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../org/settings.service";
import type { QuotePdfBusinessProfile } from "../pdf/quote-pdf.template";
import { QuotePublicTokenService } from "./quote-public-token.service";

/**
 * The customer's accept/reject comment is rich text (HTML, from
 * `RichTextEditor` on the public page) — the owner-notification email is
 * plain text (`NotificationsService.notify`'s `text` field), so this strips
 * markup down to its visible text before interpolating it, otherwise the
 * owner would see literal `<p>`/`<strong>` tags in their inbox. Uses the
 * same `node-html-parser` already a dependency for the PDF renderer's
 * rich-text-to-PDF conversion, not a regex strip (fragile against nested/
 * malformed tags).
 */
function stripHtmlToText(html: string): string {
  return parse(html).textContent.trim();
}

/**
 * The deliberately reduced, public-safe projection of a quote — everything
 * `apps/web/src/app/quote/[token]/page.tsx` needs to render, and nothing
 * more. No `orgId`, no `createdByUserId`, no `isDemo`, no `pdfFileId`, no
 * email-delivery bookkeeping (`emailStatus`/`emailError`) — none of that is
 * this customer's business, and none of it is reachable through this
 * projection even by accident (contrast with the authenticated
 * `QuotesService.getOne`, which returns the full row). `id` IS included —
 * it's needed client-side only to key React lists/requests, and leaking a
 * quote's own uuid to the one customer who already holds a valid token for
 * it is not a meaningful disclosure (the token, not the id, is what gates
 * every access).
 */
export interface PublicQuoteView {
  id: string;
  number: string | null;
  status: "sent" | "accepted" | "rejected";
  version: number;
  validUntil: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  responseComment: string | null;
  contactName: string | null;
  business: QuotePdfBusinessProfile | null;
  lines: {
    id: string;
    type: "item" | "heading" | "text";
    name: string;
    description: string | null;
    quantity: number;
    unitPriceAmount: string;
    discountPercentage: number;
    taxRatePercentage: number;
    lineTotalAmount: string;
  }[];
}

export interface RequestProvenance {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * PRD F3 Stage 3 (S-03.5/S-03.6/S-03.7) — the service backing the public,
 * unauthenticated quote link. Every method here takes a raw token string
 * (never an id — a caller with only a quote id and no valid token must
 * never be able to reach any of this), verifies it via
 * `QuotePublicTokenService`, and re-checks the quote's own status inside a
 * row-locked transaction for the mutating actions so two near-simultaneous
 * accept clicks on the same token cannot both succeed (mirrors
 * `QuotesService.send()`/`revise()`'s own locking discipline — see those
 * methods' comments).
 */
@Injectable()
export class PublicQuotesService {
  private readonly logger = new Logger(PublicQuotesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly tokens: QuotePublicTokenService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * `GET /public/quotes/:token` — verifies the token, loads the reduced
   * projection, and records a `viewed` event on EVERY successful view (see
   * quotes.ts's `quoteEvents` doc comment for why every view gets its own
   * row rather than deduplicating to "first view only" — the token is
   * intentionally reusable, and a repeat view is itself a signal worth
   * logging/notifying on, per S-03.7's literal "the moment a quote is
   * viewed"). Throws a clear, generic error for every invalid/expired/
   * revoked/wrong-status case — never a silent empty response.
   */
  async view(token: string, provenance: RequestProvenance): Promise<PublicQuoteView> {
    const verified = await this.tokens.verify(token);
    if (!verified) {
      throw new NotFoundException("This quote link is invalid or has expired");
    }

    const view = await this.loadProjection(verified.orgId, verified.quoteId);
    if (!view) {
      throw new NotFoundException("This quote link is invalid or has expired");
    }

    // Recording the view (and notifying the owner) happens even for an
    // already-resolved (accepted/rejected) quote — a customer re-opening
    // the link after deciding is still a real "viewed" event worth logging,
    // and the projection above already reflects the resolved state, so
    // there's no risk of this reopening the decision.
    await this.db.insert(quoteEvents).values({
      quoteId: verified.quoteId,
      orgId: verified.orgId,
      type: "viewed",
      ipAddress: provenance.ipAddress,
      userAgent: provenance.userAgent,
    });

    const business = await this.settings.get<QuotePdfBusinessProfile>(verified.orgId, "business_profile");
    const businessName = business?.name || "Your supplier";
    void this.notifications.notify(verified.orgId, {
      subject: `${view.contactName ?? "Your customer"} viewed quote ${view.number ?? ""}`.trim(),
      text: [
        `${view.contactName ?? "Your customer"} just opened quote ${view.number ?? ""} on ${businessName}.`,
        "",
        "No action needed — this is just a heads up while it's fresh.",
      ].join("\n"),
    });

    return view;
  }

  /** `POST /public/quotes/:token/accept`. */
  async accept(token: string, comment: string | undefined, provenance: RequestProvenance): Promise<PublicQuoteView> {
    return this.respond(token, "accepted", comment, provenance);
  }

  /** `POST /public/quotes/:token/reject`. */
  async reject(token: string, comment: string | undefined, provenance: RequestProvenance): Promise<PublicQuoteView> {
    return this.respond(token, "rejected", comment, provenance);
  }

  private async respond(
    token: string,
    outcome: "accepted" | "rejected",
    comment: string | undefined,
    provenance: RequestProvenance,
  ): Promise<PublicQuoteView> {
    const verified = await this.tokens.verify(token);
    if (!verified) {
      throw new NotFoundException("This quote link is invalid or has expired");
    }

    const respondedAt = new Date();

    await this.db.transaction(async (tx) => {
      // Row-locked re-select — two concurrent accept/reject calls on the
      // same token (e.g. a doubled click, or a customer opening the link
      // in two tabs) must not both pass the `status === "sent"` check
      // below, matching QuotesService.send()'s own concurrency discipline.
      const [existing] = await tx.select().from(quotes).where(eq(quotes.id, verified.quoteId)).for("update");
      if (!existing || existing.orgId !== verified.orgId) {
        throw new NotFoundException("This quote link is invalid or has expired");
      }
      if (existing.status !== "sent") {
        // Covers: already accepted, already rejected, or (defensively) a
        // draft — a token for an already-resolved quote must fail clearly,
        // not silently succeed or silently re-apply the same outcome.
        throw new GoneException(
          existing.status === "accepted" || existing.status === "rejected"
            ? `This quote has already been ${existing.status}`
            : "This quote is not currently open for a response",
        );
      }

      await tx
        .update(quotes)
        .set({ status: outcome, respondedAt, responseComment: comment ?? null, updatedAt: respondedAt })
        .where(eq(quotes.id, verified.quoteId));

      await tx.insert(quoteEvents).values({
        quoteId: verified.quoteId,
        orgId: verified.orgId,
        type: outcome,
        comment: comment ?? null,
        ipAddress: provenance.ipAddress,
        userAgent: provenance.userAgent,
      });

      // actorUserId: null — the actor here is the quote's own contact, an
      // unauthenticated customer, not a system user (audit_log.actor_user_id
      // is nullable precisely for this case). contactId is the quote's own
      // contact, matching every other quote-mutation audit row.
      await this.auditLog.record(tx, {
        orgId: verified.orgId,
        actorUserId: null,
        action: outcome,
        entityType: "quote",
        entityId: verified.quoteId,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "sent", to: outcome }],
      });
    });

    const view = await this.loadProjection(verified.orgId, verified.quoteId);
    if (!view) {
      // Should be unreachable — the transaction above just committed this
      // exact row. Guarded so this method's return type never needs `null`.
      throw new NotFoundException("This quote link is invalid or has expired");
    }

    if (outcome === "accepted") {
      const business = await this.settings.get<QuotePdfBusinessProfile>(verified.orgId, "business_profile");
      const businessName = business?.name || "Your business";
      void this.notifications.notify(verified.orgId, {
        subject: `${view.contactName ?? "Your customer"} accepted quote ${view.number ?? ""}`.trim(),
        text: [
          `${view.contactName ?? "Your customer"} accepted quote ${view.number ?? ""} on ${businessName}.`,
          comment ? `\nTheir comment: "${stripHtmlToText(comment)}"` : "",
        ].join("\n"),
      });
    }
    // A rejection is deliberately not a separate owner-notification path in
    // Stage 3 — S-03.7's own wording only calls out "viewed or accepted".
    // The quote's own status flip (visible on the authenticated detail page)
    // is how a rejection surfaces; a future stage could extend this if a
    // genuine need for a "rejected" notification shows up.

    return view;
  }

  /**
   * Shared projection builder for view()/accept()/reject() — always
   * re-reads fresh from the DB rather than trusting any caller's
   * already-in-hand row, so the returned view is guaranteed to reflect
   * whatever was just committed. Returns null only if the quote or its
   * lines vanished between the token check and this read (should not
   * happen in practice; `quote_public_tokens`/`quotes` cascade together).
   */
  private async loadProjection(orgId: string, quoteId: string): Promise<PublicQuoteView | null> {
    const [row] = await this.db
      .select({ quote: quotes, contactName: contacts.name })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    if (!row) return null;

    // Public link is only ever meaningful for a quote that has actually
    // been issued (or already resolved) — a draft has no business being
    // reachable here (defensive; issue() is only ever called from send()).
    if (row.quote.status === "draft") return null;

    const lines = await this.db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId))
      .orderBy(quoteLines.sortOrder);

    const business = await this.settings.get<QuotePdfBusinessProfile>(orgId, "business_profile");

    return {
      id: row.quote.id,
      number: row.quote.number,
      status: row.quote.status as "sent" | "accepted" | "rejected",
      version: row.quote.version,
      validUntil: row.quote.validUntil ? new Date(row.quote.validUntil).toISOString() : null,
      currency: row.quote.currency,
      subtotalAmount: row.quote.subtotalAmount.toString(),
      discountAmount: row.quote.discountAmount.toString(),
      taxAmount: row.quote.taxAmount.toString(),
      totalAmount: row.quote.totalAmount.toString(),
      notes: row.quote.notes,
      termsAndConditions: row.quote.termsAndConditions,
      sentAt: row.quote.sentAt ? row.quote.sentAt.toISOString() : null,
      respondedAt: row.quote.respondedAt ? row.quote.respondedAt.toISOString() : null,
      responseComment: row.quote.responseComment,
      contactName: row.contactName,
      business,
      lines: lines.map((line) => ({
        id: line.id,
        type: line.type,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount.toString(),
        discountPercentage: line.discountPercentage,
        taxRatePercentage: line.taxRatePercentage,
        lineTotalAmount: line.lineTotalAmount.toString(),
      })),
    };
  }
}
