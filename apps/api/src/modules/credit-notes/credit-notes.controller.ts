import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createCreditNoteSchema, updateCreditNoteSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { CreditNotesService } from "./credit-notes.service";

/**
 * PRD §2.1/§9 — Credit Notes use the own/others capability split, same
 * shape as InvoicesController: `credit_notes.edit_own`/`edit_others` gate
 * create/update (draft-only), `credit_notes.delete_own`/`delete_others`
 * gate delete (draft-only). `issue` is a one-way workflow action, not an
 * edit, so it gets its own dedicated capability — `credit_notes.issue`.
 * Ownership checks that depend on the loaded record (`update`, `delete`)
 * are enforced in the service layer via `requireOwnershipCapability`, not
 * `@RequireCapability` here.
 */
@Controller("credit-notes")
@OrgRoles(["owner", "staff"])
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("invoiceId") invoiceId?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.list(orgId, { invoiceId, contactId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.getOne(orgId, id);
  }

  /** `GET /credit-notes/:id/history` — same pattern as InvoicesController.getHistory. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.getHistory(orgId, id);
  }

  @Post()
  @RequireCapability("credit_notes.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createCreditNoteSchema.parse(body);
    return this.creditNotesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateCreditNoteSchema.parse(body);
    return this.creditNotesService.update(orgId, id, session.user.id, input);
  }

  /** S-05.6 — allocates the gapless number, flips to issued, posts the "Credit note issued" journal entry (§7.2). Optional `revenueAccountId` in the body, same convention as InvoicesController.issue. */
  @Post(":id/issue")
  @RequireCapability("credit_notes.issue")
  @UseInterceptors(IdempotencyInterceptor)
  async issue(@Session() session: UserSession, @Param("id") id: string, @Body() body: { revenueAccountId?: string } = {}) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.issue(orgId, id, session.user.id, body?.revenueAccountId);
  }

  /** Only a draft is ever hard-deletable — see CreditNotesService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.delete(orgId, id, session.user.id);
  }
}
