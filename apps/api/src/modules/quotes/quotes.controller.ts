import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { parseEmailOverride } from "../email/email-text";
import { ApiBody } from "@nestjs/swagger";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { acceptQuoteInPersonSchema, createQuoteSchema, updateQuoteSchema } from "@spine/shared";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { QuotesService } from "./quotes.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { QueueService } from "../queue/queue.service";
import { QUOTE_SEND_EMAIL_QUEUE } from "./quote-email.worker";
import { AcceptQuoteInPersonDto } from "./quotes.dto";

/**
 * Per §2.1's permission table, quotes are NOT "Manage contacts & catalogue"
 * (Field: View) — the "Create/edit quotes" row is Owner ✅ / Staff ✅ /
 * Field ❌ (no view access at all, unlike Contacts/Catalogue). So, unlike
 * CatalogController, EVERY route here — including GETs — carries
 * `@OrgRoles(["owner", "staff"])`. `POST /:id/approve-discount` is further
 * restricted to `["owner"]` per S-03.9 ("requires my approval").
 *
 * `quotes.manage` is replaced by an own/others split (PRD §9, same pattern
 * as Contacts/Catalogue/Leads/Activities/Meetings): `quotes.edit_own`
 * gates create; update/delete carry no `@RequireCapability` here since
 * ownership depends on the record's `createdByUserId`, checked inside
 * `QuotesService` via `requireOwnershipCapability` right after its
 * existing read-before-write lookup. `send`/`revise` are one-way status
 * transitions, not edits, so they get their own dedicated capabilities
 * (`quotes.send`/`quotes.revise`) rather than folding into edit_own —
 * "can I edit my own draft" and "can I send it" are different questions
 * an Owner may want to grant separately.
 */
@Controller("quotes")
@OrgRoles(["owner", "staff"])
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly issuedPdf: IssuedPdfService,
    private readonly queue: QueueService,
  ) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.list(orgId, { status, contactId });
  }

  /**
   * Item 7 (user feedback) — a cross-quote view of every not-yet-resolved
   * `quote-send-email` job, for a "what's still sending?" screen. MUST come
   * before `@Get(":id")` below — otherwise Nest would match the literal
   * path segment "email-queue" as `:id` and route here into `getOne`
   * instead, since route matching is declaration-order-sensitive for
   * overlapping patterns on the same HTTP method.
   */
  @Get("email-queue")
  async emailQueue(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    const jobs = await this.queue.listPendingJobs(QUOTE_SEND_EMAIL_QUEUE, orgId);
    return this.quotesService.enrichEmailQueueJobs(orgId, jobs);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.getOne(orgId, id);
  }

  /** `GET /quotes/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "quote"`), same pattern as InvoicesController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.getHistory(orgId, id);
  }

  /**
   * PRD S-03.3 / US-INV-17 — a draft's PDF renders live from current data;
   * a sent quote's PDF is the file stored when it was sent, byte for byte,
   * whatever changed since (logo, address, templates). `@OrgRoles(["owner","staff"])` inherited from the controller — quotes
   * have no Field access at all per §2.1.
   */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.issuedPdf.forDownload(orgId, "quote", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
  @RequireCapability("quotes.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createQuoteSchema.parse(body);
    return this.quotesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateQuoteSchema.parse(body);
    return this.quotesService.update(orgId, id, session.user.id, input);
  }

  /**
   * The "issue" moment: allocates the gapless number and marks `sent`.
   * PRD S-03.4 — also enqueues a `quote-send-email` pg-boss job that
   * renders + persists the PDF and emails it to the quote's contact; see
   * `quotes.service.ts`'s own comment on `send` for why that happens
   * out-of-band (SMTP being down/unconfigured must never block this
   * request or the number allocation it just performed).
   */
  @Post(":id/send")
  @RequireCapability("quotes.send")
  @UseInterceptors(IdempotencyInterceptor)
  async send(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    const orgId = requireOrgId(session);
    // US-SET-21: the "Send" dialog may change this one email.
    return this.quotesService.send(orgId, id, session.user.id, parseEmailOverride("quote", body));
  }

  /** US-QUO-24 — a new draft from this quote (anyone who can create quotes). */
  @Post(":id/duplicate")
  @RequireCapability("quotes.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async duplicate(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.duplicate(orgId, id, session.user.id);
  }

  /** US-QUO-24 — "Email again": re-sends a sent quote's email. */
  @Post(":id/resend")
  @RequireCapability("quotes.send")
  @UseInterceptors(IdempotencyInterceptor)
  async resend(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    const orgId = requireOrgId(session);
    return this.quotesService.resend(orgId, id, session.user.id, parseEmailOverride("quote", body));
  }

  @Post(":id/revise")
  @RequireCapability("quotes.revise")
  @UseInterceptors(IdempotencyInterceptor)
  async revise(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.revise(orgId, id, session.user.id);
  }

  /**
   * Phase 5 (Mobile, S-11.7) — the one route on this controller Field can
   * reach, overriding the class-level `@OrgRoles(["owner", "staff"])`
   * (route-level wins per NestJS's `getAllAndOverride`, same override
   * pattern `approveDiscount` below uses in the other direction). See
   * QuotesService.acceptInPerson's own doc comment for why this is a
   * separate endpoint from the public accept link, not a session bolted
   * onto that one.
   */
  @Post(":id/accept-in-person")
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("quotes.accept_in_person")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBody({ type: AcceptQuoteInPersonDto })
  async acceptInPerson(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = acceptQuoteInPersonSchema.parse(body);
    return this.quotesService.acceptInPerson(orgId, id, session.user.id, input);
  }

  /**
   * S-03.9 — approval above the discount threshold. PRD §2.1 lists this as
   * a Team-configurable capability (default: not granted), not a hard
   * Owner-only action like "manage users/teams/permissions" — so this route
   * now accepts staff too (previously @OrgRoles(["owner"]) only), gated by
   * @RequireCapability instead. An Owner always passes regardless of Team
   * grants (CapabilityGuard's own Owner bypass).
   */
  @Post(":id/approve-discount")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("quotes.approve_discount")
  @UseInterceptors(IdempotencyInterceptor)
  async approveDiscount(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.approveDiscount(orgId, id, session.user.id);
  }

  /** Only a draft is ever hard-deletable — see QuotesService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.delete(orgId, id, session.user.id);
  }
}
