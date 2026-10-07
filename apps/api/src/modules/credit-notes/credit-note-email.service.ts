import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, creditNotes, invoices } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { creditNoteEmail } from "../email/email-templates";
import { loadEmailText, type EmailJobOverride } from "../email/email-text";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

export const NO_EMAIL_ON_FILE = "This customer has no email address. Add one to the contact, or type an address to send to.";

/**
 * US-SET-21 — emails an issued credit note to the customer with its PDF,
 * in the "Credit note" template's words (or the "Send" dialog's).
 */
@Injectable()
export class CreditNoteEmailService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly email: EmailService,
    private readonly issuedPdf: IssuedPdfService,
    private readonly audit: AuditLogService,
  ) {}

  async send(orgId: string, id: string, actorUserId: string, override: EmailJobOverride = {}): Promise<{ sentTo: string }> {
    const [row] = await this.db
      .select({ note: creditNotes, contactName: contacts.name, contactEmail: contacts.email, invoiceNumber: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!row) throw new NotFoundException("Credit note not found");
    if (row.note.status !== "issued") throw new BadRequestException("Only an issued credit note can be emailed.");
    const to = override.to ?? row.contactEmail;
    if (!to) throw new BadRequestException(NO_EMAIL_ON_FILE);
    if (!this.email.isConfigured()) throw new ServiceUnavailableException("Email isn't set up yet, so the credit note can't be sent. Download the PDF instead, or ask an Owner to set up email.");

    const brand = await loadEmailBrand(this.db, orgId);
    const template = creditNoteEmail({
      locale: brand.locale,
      businessName: brand.name,
      contactName: row.contactName,
      number: row.note.number ?? "your credit note",
      invoiceNumber: row.invoiceNumber,
      amount: row.note.totalAmount,
      currency: row.note.currency,
      text: await loadEmailText(this.db, orgId, "credit_note", override),
    });
    const rendered = renderEmail(brand, template.content);
    const pdf = override.attachPdf === false ? null : await this.issuedPdf.forEmail(orgId, "credit_note", id);
    await this.email.send({
      to,
      fromName: brand.name,
      subject: template.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: [...(pdf ? [{ filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" }] : []), ...rendered.attachments],
    });
    await this.audit.record(this.db, { orgId, actorUserId, action: "emailed", entityType: "credit_note", entityId: id, contactId: row.note.contactId, changes: { to } });
    return { sentTo: to };
  }
}
