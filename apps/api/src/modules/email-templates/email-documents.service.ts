import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { fillPlaceholders, type EmailDraft, type EmailTemplateText, type EmailTemplateType } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, creditNotes, invoices, payments, quotes } from "../../db/schema";
import { loadEmailBrand } from "../email/email-brand";
import type { EmailBrand } from "../email/email-layout";
import { creditNoteEmail, invoiceEmail, quoteEmail, receiptEmail, statementEmail, type EmailTemplate } from "../email/email-templates";
import { loadEmailText } from "../email/email-text";

const DAY = 24 * 60 * 60 * 1000;
/** A quote's link exists only once it's sent, so drafts keep `{link}` and the send fills it. */
const LINK_KEPT = "{link}";

export interface BuiltEmail {
  template: EmailTemplate;
  to: string | null;
  hasPdf: boolean;
  /** "INV-0042 · Lakeview Homes" — what the preview was made from. */
  source: string;
}

/**
 * US-SET-21/22 (D-153) — builds a customer email for one document in a
 * template's words: the "Send" dialog's draft, and Settings › Emails'
 * preview (a recent real document, or sample data when there's none).
 * Senders build the same email through the same functions.
 */
@Injectable()
export class EmailDocumentsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The email for a document, in the given words (the saved template when absent). Statements are drafted by their own dialog's route. */
  async build(orgId: string, type: Exclude<EmailTemplateType, "statement">, id: string, text?: EmailTemplateText): Promise<BuiltEmail> {
    const brand = await loadEmailBrand(this.db, orgId);
    const words = text ?? (await loadEmailText(this.db, orgId, type));
    const base = { businessName: brand.name, locale: brand.locale };
    if (type === "quote") {
      const [row] = await this.db.select({ quote: quotes, name: contacts.name, email: contacts.email }).from(quotes).leftJoin(contacts, eq(quotes.contactId, contacts.id)).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id)));
      if (!row) throw new NotFoundException("Quote not found");
      // A draft quote gets its number when it's sent, so its draft keeps {document_number} for the send to fill.
      const template = quoteEmail({ ...base, contactName: row.name, number: row.quote.number ?? "{document_number}", total: row.quote.totalAmount, currency: row.quote.currency, validUntil: row.quote.validUntil, link: LINK_KEPT, text: words });
      return { template, to: row.email, hasPdf: true, source: `${row.quote.number ?? "Draft quote"} · ${row.name ?? "Customer"}` };
    }
    if (type === "invoice" || type === "reminder") {
      const [row] = await this.db.select({ invoice: invoices, name: contacts.name, email: contacts.email }).from(invoices).leftJoin(contacts, eq(invoices.contactId, contacts.id)).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
      if (!row) throw new NotFoundException("Invoice not found");
      const i = row.invoice;
      const daysOverdue = i.dueDate ? Math.floor((Date.now() - new Date(i.dueDate).getTime()) / DAY) : null;
      const template = invoiceEmail({
        ...base,
        contactName: row.name,
        number: i.number ?? "your invoice",
        currency: i.currency,
        total: i.totalAmount,
        retention: i.retentionAmount,
        balanceDue: i.totalAmount - i.retentionAmount - i.amountPaid - i.creditedAmount,
        dueDate: i.dueDate,
        reminder: type === "reminder" ? { daysOverdue } : undefined,
        paymentInstructions: i.paymentInstructions,
        upiQrAmount: i.upiQrAmount,
        text: words,
      });
      return { template, to: row.email, hasPdf: i.type !== "opening", source: `${i.number ?? "Draft invoice"} · ${row.name ?? "Customer"}` };
    }
    if (type === "receipt") {
      const [row] = await this.db.select({ payment: payments, name: contacts.name, email: contacts.email }).from(payments).leftJoin(contacts, eq(payments.contactId, contacts.id)).where(and(eq(payments.orgId, orgId), eq(payments.id, id)));
      if (!row) throw new NotFoundException("Payment not found");
      const template = receiptEmail({ ...base, contactName: row.name, number: row.payment.number ?? "your receipt", amount: row.payment.amount, currency: row.payment.currency, text: words });
      return { template, to: row.email, hasPdf: true, source: `${row.payment.number ?? "Payment"} · ${row.name ?? "Customer"}` };
    }
    const [row] = await this.db
      .select({ note: creditNotes, name: contacts.name, email: contacts.email, invoiceNumber: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!row) throw new NotFoundException("Credit note not found");
    const template = creditNoteEmail({ ...base, contactName: row.name, number: row.note.number ?? "your credit note", invoiceNumber: row.invoiceNumber, amount: row.note.totalAmount, currency: row.note.currency, text: words });
    return { template, to: row.email, hasPdf: true, source: `${row.note.number ?? "Credit note"} · ${row.name ?? "Customer"}` };
  }

  /** The draft a "Send" dialog starts from: the template with this document's details filled in. */
  async draft(orgId: string, type: Exclude<EmailTemplateType, "statement">, id: string): Promise<EmailDraft> {
    const text = await loadEmailText(this.db, orgId, type);
    const built = await this.build(orgId, type, id, text);
    return draftOf(type, text, built);
  }

  /** The most recent document an email of this type would go with, for the preview. */
  async latestId(orgId: string, type: Exclude<EmailTemplateType, "statement">): Promise<string | null> {
    if (type === "quote") {
      const [r] = await this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), isNotNull(quotes.number))).orderBy(desc(quotes.createdAt)).limit(1);
      return r?.id ?? null;
    }
    if (type === "invoice" || type === "reminder") {
      const [r] = await this.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"))).orderBy(desc(invoices.issuedAt)).limit(1);
      return r?.id ?? null;
    }
    if (type === "receipt") {
      const [r] = await this.db.select({ id: payments.id }).from(payments).where(eq(payments.orgId, orgId)).orderBy(desc(payments.createdAt)).limit(1);
      return r?.id ?? null;
    }
    const [r] = await this.db.select({ id: creditNotes.id }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"))).orderBy(desc(creditNotes.createdAt)).limit(1);
    return r?.id ?? null;
  }

  /** The email with made-up details, for a preview when there's no real document yet. */
  sample(brand: EmailBrand, type: EmailTemplateType, text: EmailTemplateText): BuiltEmail {
    const base = { businessName: brand.name, locale: brand.locale, contactName: "Alan Brooks" };
    const currency = brand.currency ?? "USD";
    const due = new Date(Date.now() + 14 * DAY);
    const template =
      type === "quote"
        ? quoteEmail({ ...base, number: "QUO-0000", total: 454_250n, currency, validUntil: due, link: LINK_KEPT, text })
        : type === "invoice" || type === "reminder"
          ? invoiceEmail({ ...base, number: "INV-0000", currency, total: 454_250n, retention: 0n, balanceDue: 454_250n, dueDate: type === "reminder" ? new Date(Date.now() - 7 * DAY) : due, reminder: type === "reminder" ? { daysOverdue: 7 } : undefined, text })
          : type === "receipt"
            ? receiptEmail({ ...base, number: "RCP-0000", amount: 454_250n, currency, text })
            : type === "credit_note"
              ? creditNoteEmail({ ...base, number: "CRN-0000", invoiceNumber: "INV-0000", amount: 50_000n, currency, text })
              : statementEmail({ ...base, period: "1 Jul – 30 Sep", balanceDue: 454_250n, currency, text });
    return { template, to: null, hasPdf: true, source: "Sample details" };
  }
}

/** The dialog's starting text: subject and message with this document's details, `{link}` kept for the send to fill. */
export function draftOf(type: EmailTemplateType, text: EmailTemplateText, built: Pick<BuiltEmail, "template" | "to" | "hasPdf">): EmailDraft {
  const values = built.template.values ?? {};
  return {
    type,
    to: built.to,
    subject: fillPlaceholders(text.subject, values).replace(/\s+/g, " ").trim(),
    message: fillPlaceholders(text.body, values).trim(),
    hasPdf: built.hasPdf,
  };
}
