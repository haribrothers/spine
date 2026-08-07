import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createQuoteSchema, updateQuoteSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { QuotesService } from "./quotes.service";

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
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.list(orgId, { status, contactId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.quotesService.getOne(orgId, id);
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
   * Stage 1's "issue" moment: allocates the gapless number and marks
   * `sent`. No email is sent yet — that's Stage 2, which will hook into
   * this same endpoint (see quotes.service.ts's own comment on `send`).
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
