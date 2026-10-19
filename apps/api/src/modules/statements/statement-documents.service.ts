import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { EmailDraft, EmailTemplateText } from "@spine/shared";
import { draftOf } from "../email-templates/email-documents.service";
import { loadEmailText } from "../email/email-text";
import { renderToBuffer } from "@react-pdf/renderer";
import { NO_INVOICES_YET, resolveDocumentBranding, type SendStatementInput, type StatementQuery, resolveDocumentLayout, type DocumentLayout } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activities } from "../../db/schema";
import { orgLocale } from "../../common/money-format";
import { AuditLogService } from "../audit/audit-log.service";
import { EmailService } from "../email/email.service";
import { loadEmailBrand } from "../email/email-brand";
import { emailMoney, renderEmail } from "../email/email-layout";
import { statementEmail, type EmailTemplate } from "../email/email-templates";
import { FilesService } from "../files/files.service";
import { loadSignatureDataUri } from "../pdf/signature";
import { SettingsService } from "../org/settings.service";
import { StatementPdfDocument, statementPeriodLabel, type StatementPdfBusiness } from "./statement-pdf.template";
import { StatementsService } from "./statements.service";

/**
 * US-PAY-14 — the statement as a PDF (download) and as an email to the
 * customer, which is logged on their timeline as a done note.
 */
@Injectable()
export class StatementDocumentsService {
  private readonly logger = new Logger(StatementDocumentsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly statements: StatementsService,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
    private readonly email: EmailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async pdf(orgId: string, contactId: string, query: StatementQuery): Promise<{ buffer: Buffer; filename: string; balanceDue: bigint; currency: string; contactName: string; period: string }> {
    const statement = await this.statements.build(orgId, contactId, query);
    const business = await this.settings.get<StatementPdfBusiness & { logoUrl?: string }>(orgId, "business_profile");
    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const logoDataUri = business?.logoUrl ? await this.logo(orgId, business.logoUrl) : undefined;
    // US-SET-17–US-SET-19: Settings › Documents.
    const savedLayout = await this.settings.get<DocumentLayout>(orgId, "document_layout");
    const layout = resolveDocumentLayout(savedLayout, "statement");
    const signatureDataUri = await loadSignatureDataUri(this.files, orgId, savedLayout, layout);
    const buffer = await renderToBuffer(StatementPdfDocument({ statement, business, logoDataUri, locale: await orgLocale(this.db, orgId), branding, layout, signatureDataUri }));
    const slug = statement.contactName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "customer";
    return {
      buffer,
      filename: `statement-${slug}-${query.to}.pdf`,
      balanceDue: BigInt(statement.balanceDue),
      currency: statement.currency,
      contactName: statement.contactName,
      period: statementPeriodLabel(query.from, query.to),
    };
  }

  /** US-SET-21 — what the statement dialog starts from: the "Statement" template with this customer's period and balance. */
  async draft(orgId: string, contactId: string, query: StatementQuery): Promise<EmailDraft> {
    const { text, template, to } = await this.emailParts(orgId, contactId, query);
    return draftOf("statement", text, { template, to, hasPdf: true });
  }

  /** The "Statement" template and this customer's email built from it — the dialog's draft, and what AI drafts from (US-AI-11). */
  async emailParts(orgId: string, contactId: string, query: StatementQuery): Promise<{ text: EmailTemplateText; template: EmailTemplate; to: string | null }> {
    const statement = await this.statements.build(orgId, contactId, query);
    const brand = await loadEmailBrand(this.db, orgId);
    const text = await loadEmailText(this.db, orgId, "statement");
    const template = statementEmail({
      locale: brand.locale,
      businessName: brand.name,
      contactName: statement.contactName,
      period: statementPeriodLabel(query.from, query.to),
      balanceDue: BigInt(statement.balanceDue),
      currency: statement.currency,
      text,
    });
    return { text, template, to: statement.contactEmail ?? null };
  }

  async send(orgId: string, contactId: string, actorUserId: string, input: SendStatementInput): Promise<{ sentTo: string }> {
    const statement = await this.statements.build(orgId, contactId, input);
    if (!statement.hasInvoices) throw new BadRequestException(NO_INVOICES_YET);
    if (!this.email.isConfigured()) throw new ServiceUnavailableException("Email isn't set up yet, so the statement can't be sent. Download the PDF instead, or ask an Owner to set up email.");

    const doc = await this.pdf(orgId, contactId, input);
    const brand = await loadEmailBrand(this.db, orgId);
    const template = statementEmail({
      locale: brand.locale,
      businessName: brand.name,
      contactName: doc.contactName,
      period: doc.period,
      balanceDue: doc.balanceDue,
      currency: doc.currency,
      // US-SET-21: the "Statement" template, with the dialog's subject and message when it changed them.
      text: await loadEmailText(this.db, orgId, "statement", { subject: input.subject ?? undefined, message: input.message || undefined }),
    });
    const rendered = renderEmail(brand, template.content);
    await this.email.send({
      to: input.email,
      subject: template.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: [...rendered.attachments, { filename: doc.filename, content: doc.buffer, contentType: "application/pdf" }],
      log: { orgId, kind: "statement", entityType: "contact", entityId: contactId, userId: actorUserId },
    });

    await this.db.transaction(async (tx) => {
      await tx.insert(activities).values({
        orgId,
        contactId,
        type: "note",
        notes: `Statement sent to ${input.email} for ${doc.period}. Balance due ${emailMoney(doc.balanceDue, doc.currency, brand.locale)}.`,
        doneAt: new Date(),
        createdByUserId: actorUserId,
      });
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "statement_sent",
        entityType: "contact",
        entityId: contactId,
        contactId,
        changes: [{ field: "email", from: null, to: input.email }],
      });
    });
    return { sentTo: input.email };
  }

  private async logo(orgId: string, logoUrl: string): Promise<string | undefined> {
    try {
      const fileId = logoUrl.match(/\/files\/([0-9a-fA-F-]{36})/)?.[1];
      if (!fileId) return undefined;
      const { bytes, mimeType } = await this.files.readBytes(orgId, fileId);
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    } catch (err) {
      this.logger.warn(`Could not fetch org logo for the statement, continuing without it: ${(err as Error).message}`);
      return undefined;
    }
  }
}
