import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, invoices } from "../../db/schema";
import { loadEmailBrand } from "../email/email-brand";
import { EMAIL_LOGO_CID, renderEmail } from "../email/email-layout";
import { invoiceEmail } from "../email/email-templates";

const DAY = 24 * 60 * 60 * 1000;

/**
 * US-INV-18 / US-INV-19 (D-091) — automatic payment reminders: the
 * settings preview, and the daily run that sends them.
 */
@Injectable()
export class InvoiceRemindersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * "Preview email": the reminder the most overdue unpaid invoice would get
   * today, or a sample when nothing is overdue. The logo is inlined so the
   * browser can show it (emails attach it instead).
   */
  async preview(orgId: string): Promise<{ subject: string; html: string; sample: boolean }> {
    const balance = sql<bigint>`${invoices.totalAmount} - ${invoices.retentionAmount} - ${invoices.amountPaid} - ${invoices.creditedAmount}`;
    const [row] = await this.db
      .select({ invoice: invoices, contactName: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), isNotNull(invoices.dueDate), sql`${balance} > 0`, sql`${invoices.dueDate} < current_date`))
      .orderBy(asc(invoices.dueDate))
      .limit(1);

    const brand = await loadEmailBrand(this.db, orgId);
    const inv = row?.invoice;
    const template = inv
      ? invoiceEmail({
          businessName: brand.name,
          locale: brand.locale,
          contactName: row!.contactName,
          number: inv.number ?? "your invoice",
          currency: inv.currency,
          total: inv.totalAmount,
          retention: inv.retentionAmount,
          balanceDue: inv.totalAmount - inv.retentionAmount - inv.amountPaid - inv.creditedAmount,
          dueDate: inv.dueDate,
          reminder: { daysOverdue: Math.floor((Date.now() - new Date(inv.dueDate!).getTime()) / DAY) },
          paymentInstructions: inv.paymentInstructions,
        })
      : invoiceEmail({
          businessName: brand.name,
          locale: brand.locale,
          contactName: "Alan Brooks",
          number: "INV-0000",
          currency: "USD",
          total: 454_250n,
          retention: 0n,
          balanceDue: 454_250n,
          dueDate: new Date(Date.now() - 7 * DAY),
          reminder: { daysOverdue: 7 },
          paymentInstructions: null,
        });
    const email = renderEmail(brand, template.content);
    const logo = email.attachments.find((a) => a.cid === EMAIL_LOGO_CID);
    const html = logo ? email.html.replaceAll(`cid:${EMAIL_LOGO_CID}`, `data:${logo.contentType};base64,${Buffer.from(logo.content as Buffer).toString("base64")}`) : email.html;
    return { subject: template.subject, html, sample: !inv };
  }
}
