import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createQuoteSchema, updateQuoteSchema } from "@spine/shared";
import type { Response } from "express";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { QuotesService } from "./quotes.service";
import { QuotePdfService } from "../pdf/quote-pdf.service";
import { QueueService } from "../queue/queue.service";
import { QUOTE_SEND_EMAIL_QUEUE } from "./quote-email.worker";

/**
 * Per §2.1's permission table, quotes are NOT "Manage contacts & catalogue"
 * (Field: View) — the "Create/edit quotes" row is Owner ✅ / Staff ✅ /
 * Field ❌ (no view access at all, unlike Contacts/Catalogue). So, unlike
 * CatalogController, EVERY route here — including GETs — carries
 * `@OrgRoles(["owner", "staff"])`. `POST /:id/approve-discount` is further
 * restricted to `["owner"]` per S-03.9 ("requires my approval").
 */
@Controller("quotes")
@OrgRoles(["owner", "staff"])
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotePdfService: QuotePdfService,
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

  /**
   * PRD S-03.3 — streams a branded PDF of the quote, rendered live from its
   * stored line/total snapshot on every call (not served from
   * `pdfFileId`'s persisted copy, even after send — a live render and the
   * persisted send-time copy are byte-identical for a `sent` quote, since
   * its snapshot is immutable, so there's no correctness reason to prefer
   * one over the other; rendering live keeps this one code path correct
   * for both drafts, which have no persisted PDF yet, without a branch).
   * `@OrgRoles(["owner","staff"])` inherited from the controller — quotes
   * have no Field access at all per §2.1.
   */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.quotePdfService.render(orgId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
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
  @UseInterceptors(IdempotencyInterceptor)
  async send(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.send(orgId, id, session.user.id);
  }

  @Post(":id/revise")
  @UseInterceptors(IdempotencyInterceptor)
  async revise(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.revise(orgId, id, session.user.id);
  }

  /** S-03.9 — owner-only, on top of this controller's own staff-inclusive default. */
  @Post(":id/approve-discount")
  @OrgRoles(["owner"])
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
