import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { applyPaymentCreditSchema, createCreditNoteSchema, updateCreditNoteSchema } from "@spine/shared";
import { RequireCapability, RequireSectionOpen } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import type { Response } from "express";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { CreditNotesService } from "./credit-notes.service";
import { CreditNoteEmailService } from "./credit-note-email.service";
import { parseEmailOverride } from "../email/email-text";

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
@RequireSectionOpen("credit_notes.open")
@OrgRoles(["owner", "staff"])
export class CreditNotesController {
  constructor(
    private readonly creditNotesService: CreditNotesService,
    private readonly issuedPdf: IssuedPdfService,
    private readonly creditNoteEmail: CreditNoteEmailService,
  ) {}

  /** US-SET-21 — emails an issued credit note with its PDF; sending documents to customers is `invoices.send`. */
  @Post(":id/send-email")
  @RequireCapability("invoices.send")
  @UseInterceptors(IdempotencyInterceptor)
  async sendEmail(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    return this.creditNoteEmail.send(requireOrgId(session), id, session.user.id, parseEmailOverride("credit_note", body));
  }

  @Get()
  async list(@Session() session: UserSession, @Query("invoiceId") invoiceId?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.list(orgId, { invoiceId, contactId });
  }

  /** `GET /credit-notes/creditable?invoiceId=` (US-INV-36) — an invoice's item lines and what's left to credit on each. */
  @Get("creditable")
  async creditable(@Session() session: UserSession, @Query("invoiceId") invoiceId?: string) {
    if (!invoiceId) throw new BadRequestException("Choose the invoice to credit.");
    return this.creditNotesService.creditable(requireOrgId(session), invoiceId);
  }

  /** `POST /credit-notes/preview` (US-INV-36) — the totals, tax by name and split for an unsaved credit note. A read: nothing is written, so no Idempotency-Key. */
  @Post("preview")
  @HttpCode(200)
  @RequireCapability("credit_notes.edit_own")
  async preview(@Session() session: UserSession, @Body() body: unknown) {
    return this.creditNotesService.preview(requireOrgId(session), createCreditNoteSchema.parse(body));
  }

  /** `GET /credit-notes/:id/activity` (US-INV-39) — the credit note's story, newest first. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id") id: string) {
    return this.creditNotesService.activity(requireOrgId(session), id);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.getOne(orgId, id);
  }

  /** US-INV-17 (D-116) — live for a draft; the PDF stored at issue for an issued credit note. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.issuedPdf.forDownload(orgId, "credit_note", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
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

  /** US-PAY-16 (D-142) — applies a credit note's spare credit to the customer's other invoices (P6). */
  @Post(":id/apply-credit")
  @RequireCapability("payments.apply_credit")
  @UseInterceptors(IdempotencyInterceptor)
  async applyCredit(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const parsed = applyPaymentCreditSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Choose the invoices and amounts to apply.");
    return this.creditNotesService.applyCredit(requireOrgId(session), session.user.id, id, parsed.data);
  }

  /** Only a draft is ever hard-deletable — see CreditNotesService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.creditNotesService.delete(orgId, id, session.user.id);
  }
}
