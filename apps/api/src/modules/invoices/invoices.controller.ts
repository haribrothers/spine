import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { bulkInvoiceIdsSchema, createInvoiceSchema, updateInvoiceSchema, voidInvoiceSchema } from "@spine/shared";
import type { Response } from "express";
import { PickerAllowed, RequireCapability, RequireSectionOpen } from "../../auth/require-capability.decorator";
import { SectionClosed, forPicker } from "../../common/picker";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { InvoicesService } from "./invoices.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { InvoicePdfService } from "../pdf/invoice-pdf.service";
import { InvoiceBulkPdfService } from "./invoice-bulk-pdf.service";
import { IssueCreditService } from "./issue-credit.service";
import { parseEmailOverride } from "../email/email-text";
import { hasCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";

/** US-TEAM-31 — what a payment or credit note needs of an invoice when Invoices is closed for the caller. */
const INVOICE_PICKER_FIELDS = ["id", "number", "type", "status", "contactId", "contactName", "currency", "issueDate", "dueDate", "totalAmount", "balanceDue", "leftToCredit"] as const;

/**
 * PRD §2.1/§9 — Invoices use the own/others capability split:
 * `invoices.edit_own`/`edit_others` gate create/update (already
 * draft-only; an issued invoice can never be edited by anyone),
 * `invoices.delete_own`/`delete_others` gate delete (already draft-only).
 * Issue/void/send/send-reminder are one-way workflow actions, not edits,
 * so they get their own dedicated capabilities — `invoices.issue`,
 * `invoices.void`, `invoices.send`, `invoices.send_reminder` — independent
 * of the edit/delete pair, same pattern as Quotes'
 * `quotes.send`/`quotes.revise`. Ownership checks that depend on the
 * loaded record (`update`, `delete`) are enforced in the service layer via
 * `requireOwnershipCapability`, not `@RequireCapability` here. No view
 * access at all for Field — every route carries
 * `@OrgRoles(["owner", "staff"])`.
 */
@Controller("invoices")
@RequireSectionOpen("invoices.open")
@OrgRoles(["owner", "staff"])
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly issuedPdf: IssuedPdfService,
    private readonly bulkPdfs: InvoiceBulkPdfService,
    private readonly issueCredit: IssueCreditService,
    private readonly invoicePdf: InvoicePdfService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** US-TEAM-31: recording a payment or a credit note picks invoices with `?picker=1` while Invoices is closed. */
  @Get()
  @PickerAllowed()
  async list(@Session() session: UserSession, @SectionClosed() closed: boolean, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return forPicker(closed, await this.invoicesService.list(orgId, { status, contactId }), INVOICE_PICKER_FIELDS);
  }

  /**
   * US-INV-34 (D-217) — the builder's Preview PDF: the invoice as it is on
   * screen, saved or not, watermarked "DRAFT". Nothing is written, so it's
   * a read sent as POST (the lines don't fit a URL): no Idempotency-Key.
   * Declared before `:id` routes.
   */
  @Post("preview-pdf")
  @HttpCode(200)
  @RequireCapability("invoices.edit_own")
  async previewPdf(@Session() session: UserSession, @Body() body: unknown, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { invoiceId, ...fields } = (body ?? {}) as { invoiceId?: unknown };
    const input = createInvoiceSchema.parse(fields);
    const draft = await this.invoicesService.previewDraft(orgId, session.user.id, input, typeof invoiceId === "string" ? invoiceId : undefined);
    const buffer = await this.invoicePdf.renderInvoice(orgId, draft.invoice, draft.lines, draft.contactName, draft.contactEmail);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="invoice-draft.pdf"');
    res.send(buffer);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.getDetail(orgId, id);
  }

  /** `GET /invoices/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "invoice"`), same pattern as ContactsController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.getHistory(orgId, id);
  }

  /** US-INV-32 (D-217) — the invoice's story for its Activity panel. Owners and Staff, like every invoice route. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id") id: string) {
    return this.invoicesService.activity(requireOrgId(session), id);
  }

  /** US-INV-35 (D-217) — a new draft from any invoice the caller can see; the draft is theirs. */
  @Post(":id/duplicate")
  @RequireCapability("invoices.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async duplicate(@Session() session: UserSession, @Param("id") id: string) {
    return this.invoicesService.duplicate(requireOrgId(session), id, session.user.id);
  }

  /** US-INV-17 — live for a draft; the PDF stored at issue for an issued invoice, same as QuotesController.getPdf. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.issuedPdf.forDownload(orgId, "invoice", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
  @RequireCapability("invoices.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createInvoiceSchema.parse(body);
    return this.invoicesService.create(orgId, session.user.id, input);
  }

  /**
   * S-03.10's invoice half — creates a draft invoice from an accepted
   * quote's own snapshot. See InvoicesService.convertFromQuote's own doc
   * comment. `confirm` (optional, defaults false) is only meaningful when
   * the org's `quote_conversion_guard` setting is "warn": passing it lets
   * the caller proceed after being shown a 409's warning body once
   * (QuoteConversionGuardService.check), for a quote that's already been
   * converted before.
   */
  @Post("from-quote/:quoteId")
  @RequireCapability("invoices.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async convertFromQuote(@Session() session: UserSession, @Param("quoteId") quoteId: string, @Body("confirm") confirm?: boolean) {
    const orgId = requireOrgId(session);
    return this.invoicesService.convertFromQuote(orgId, session.user.id, quoteId, confirm === true);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateInvoiceSchema.parse(body);
    return this.invoicesService.update(orgId, id, session.user.id, input);
  }

  /** S-05.3 — allocates the gapless number, flips to issued, posts the "Invoice issued" journal entry (§7.2). Optional `revenueAccountId` in the body lets the caller pick an income account; omitted defaults to "Sales — Services". */
  @Post(":id/issue")
  @RequireCapability("invoices.issue")
  @UseInterceptors(IdempotencyInterceptor)
  async issue(@Session() session: UserSession, @Param("id") id: string, @Body() body: { revenueAccountId?: string; applyCredit?: boolean } = {}) {
    const orgId = requireOrgId(session);
    // D-187: "Apply credit first" needs the same right as "Apply credit".
    if (body?.applyCredit === true && !(await hasCapability(this.db, { orgId, userId: session.user.id }, "payments.apply_credit"))) {
      throw new ForbiddenException("You don't have permission to apply credit. Issue it without, or ask an owner.");
    }
    return this.invoicesService.issue(orgId, id, session.user.id, body?.revenueAccountId, {
      afterIssue: body?.applyCredit === true ? (invoiceId) => this.issueCredit.apply(orgId, session.user.id, invoiceId) : undefined,
    });
  }

  /** D-187 — the customer's credit an invoice could use when it's issued: `{ amount }` in the invoice's currency. */
  @Get(":id/available-credit")
  async availableCredit(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const invoice = await this.invoicesService.getOne(orgId, id);
    const sources = await this.issueCredit.available(orgId, invoice.contactId, invoice.currency);
    return { amount: sources.reduce((sum, s) => sum + s.amount, 0n).toString() };
  }

  /** S-05.7 — queues emailing the invoice PDF to its contact. Deliberately separate from `issue` — see InvoicesService.sendEmail's own doc comment. */
  @Post(":id/send-email")
  @RequireCapability("invoices.send")
  @UseInterceptors(IdempotencyInterceptor)
  async sendEmail(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    const orgId = requireOrgId(session);
    // US-SET-21: the "Send" dialog may change this one email.
    return this.invoicesService.sendEmail(orgId, id, session.user.id, parseEmailOverride("invoice", body));
  }

  /**
   * US-INV-24 (D-097) — up to 100 invoices' stored PDFs as one ZIP. A read,
   * like `GET /invoices/:id/pdf`, so no capability beyond Owner/Staff and
   * no Idempotency-Key replay (it changes nothing). Drafts are skipped; the
   * skipped list rides in the `X-Spine-Skipped` header (URI-encoded JSON).
   */
  @Post("bulk/pdf")
  async bulkPdf(@Session() session: UserSession, @Body() body: unknown, @Res() res: Response) {
    const parsed = bulkInvoiceIdsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select 100 or fewer invoices.");
    const { zip, filename, result } = await this.bulkPdfs.build(requireOrgId(session), parsed.data.ids);
    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Spine-Skipped", encodeURIComponent(JSON.stringify(result.skipped)));
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Spine-Skipped");
    res.send(zip);
  }

  /** US-INV-23 (D-097) — reminders for up to 100 invoices; reports each skipped one with the reason. */
  @Post("bulk/send-reminders")
  @RequireCapability("invoices.send_reminder")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkSendReminders(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = bulkInvoiceIdsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select up to 100 invoices.");
    return this.invoicesService.bulkSendReminders(requireOrgId(session), session.user.id, parsed.data.ids);
  }

  /** S-05.10 — one-click payment reminder for an overdue invoice; reuses sendEmail's own queue/worker with reminder-flavored copy, see InvoicesService.sendReminder's own doc comment. */
  @Post(":id/send-reminder")
  @RequireCapability("invoices.send_reminder")
  @UseInterceptors(IdempotencyInterceptor)
  async sendReminder(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    const orgId = requireOrgId(session);
    return this.invoicesService.sendReminder(orgId, id, session.user.id, parseEmailOverride("reminder", body));
  }

  /** S-05.8 — void with a required reason; posts a reversing journal entry. */
  @Post(":id/void")
  @RequireCapability("invoices.void")
  @UseInterceptors(IdempotencyInterceptor)
  async void(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = voidInvoiceSchema.parse(body);
    return this.invoicesService.void(orgId, id, session.user.id, input.reason);
  }

  /** Only a draft is ever hard-deletable — see InvoicesService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.delete(orgId, id, session.user.id);
  }
}
