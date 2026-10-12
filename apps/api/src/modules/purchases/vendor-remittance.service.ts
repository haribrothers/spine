import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import type { SendRemittanceInput } from "@spine/shared";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts } from "../../db/schema";
import { orgLocale } from "../../common/money-format";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { EmailService } from "../email/email.service";
import { loadEmailBrand } from "../email/email-brand";
import { emailMoney, renderEmail } from "../email/email-layout";
import { SettingsService } from "../org/settings.service";
import { registerPdfFonts } from "../pdf/pdf-fonts";
import { RemittancePdfDocument } from "./remittance-pdf.template";
import { VendorPaymentsService } from "./vendor-payments.service";

const METHOD_LABELS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", upi: "UPI", other: "Other" };

/**
 * US-PUR-54 (D-229) — a vendor payment's remittance advice: a PDF of what
 * it paid against which bills (generated when asked for, never stored),
 * and an email to the vendor with it attached, from the dialog's address,
 * subject and message. The email log and the payment's Activity record it.
 */
@Injectable()
export class VendorRemittanceService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payments: VendorPaymentsService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async pdf(orgId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const payment = await this.payments.getOne(orgId, id);
    const [vendor] = await this.db.select({ name: contacts.name, taxId: contacts.taxId, email: contacts.email }).from(contacts).where(eq(contacts.id, payment.contactId));
    const profile = await this.settings.get<{ name?: string; address?: string; email?: string; taxId?: string }>(orgId, "business_profile");
    const brand = await loadEmailBrand(this.db, orgId);
    registerPdfFonts();
    const number = payment.number ?? "Payment";
    const buffer = await renderToBuffer(
      RemittancePdfDocument({
        business: { name: profile?.name || brand.name, address: profile?.address, email: profile?.email, taxId: profile?.taxId },
        vendor: { name: vendor?.name ?? payment.contactName ?? "Vendor", taxId: vendor?.taxId ?? null, email: vendor?.email ?? null },
        payment: {
          number,
          date: (typeof payment.date === "string" ? payment.date : new Date(payment.date).toISOString()).slice(0, 10),
          method: METHOD_LABELS[payment.method] ?? payment.method,
          reference: payment.reference,
          account: payment.moneyAccount?.name ?? null,
          amount: payment.amount,
          currency: payment.currency,
        },
        bills: payment.paidTo.map((b) => ({ number: b.billNumber, date: b.billDate, total: BigInt(b.billTotal), paid: BigInt(b.amount), stillOwed: BigInt(b.billBalance) })),
        locale: await orgLocale(this.db, orgId),
      }),
    );
    return { buffer, filename: `remittance-${number}.pdf` };
  }

  /** What the email dialog starts from: the vendor's address, a subject and a message naming the bills. */
  async draft(orgId: string, id: string, actorUserId: string, actorName: string | null): Promise<{ to: string | null; subject: string; body: string; emailReady: boolean }> {
    const payment = await this.payments.getOne(orgId, id);
    await this.requireRight(orgId, actorUserId, payment.createdByUserId);
    const [vendor] = await this.db.select({ name: contacts.name, email: contacts.email }).from(contacts).where(eq(contacts.id, payment.contactId));
    const brand = await loadEmailBrand(this.db, orgId);
    const money = (v: bigint | string) => emailMoney(BigInt(v), payment.currency, brand.locale);
    const date = new Date(payment.date).toLocaleDateString(brand.locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const method = (METHOD_LABELS[payment.method] ?? payment.method).toLowerCase();
    const bills = payment.paidTo.map((b) => `${money(b.amount)} against your ${b.billNumber}`);
    const list = bills.length <= 1 ? (bills[0] ?? "") : `${bills.slice(0, -1).join(", ")} and ${bills.at(-1)}`;
    const body = [
      `Hello ${vendor?.name ?? "there"},`,
      `We've paid ${money(payment.amount)} by ${method} on ${date}${payment.reference ? ` (${payment.reference})` : ""}${list ? `: ${list}` : ""}. The remittance advice is attached.`,
      ["Thanks,", actorName, brand.name].filter(Boolean).join("\n"),
    ].join("\n\n");
    return { to: vendor?.email ?? null, subject: `Remittance advice — ${payment.number ?? "payment"} from ${brand.name}`, body, emailReady: this.email.isConfigured() };
  }

  async send(orgId: string, id: string, actorUserId: string, input: SendRemittanceInput): Promise<{ sentTo: string }> {
    if (!this.email.isConfigured()) throw new ServiceUnavailableException("Email isn't set up yet, so the remittance advice can't be sent. Download it instead, or ask an Owner to set up email.");
    const payment = await this.payments.getOne(orgId, id);
    await this.requireRight(orgId, actorUserId, payment.createdByUserId);
    if (!payment.paidTo.length) throw new BadRequestException("This payment didn't pay any bills, so there's nothing to tell the vendor.");
    const doc = await this.pdf(orgId, id);
    const brand = await loadEmailBrand(this.db, orgId);
    const rendered = renderEmail(brand, {
      heading: "Remittance advice",
      paragraphs: input.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      facts: [
        { label: "Payment", value: payment.number ?? "" },
        { label: "Amount", value: emailMoney(payment.amount, payment.currency, brand.locale) },
      ],
    });
    await this.email.send({
      to: input.to,
      subject: input.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: [...rendered.attachments, { filename: doc.filename, content: doc.buffer, contentType: "application/pdf" }],
      log: { orgId, kind: "remittance", entityType: "vendor_payment", entityId: id, userId: actorUserId },
    });
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "remittance_sent",
        entityType: "vendor_payment",
        entityId: id,
        contactId: payment.contactId,
        changes: [{ field: "email", from: null, to: input.to }],
      });
    });
    return { sentTo: input.to };
  }

  /** Emailing it needs the right to record vendor payments: own, or others' (07-security). */
  private requireRight(orgId: string, userId: string, createdBy: string | null) {
    return requireOwnershipCapability(this.db, { orgId, userId }, createdBy, { own: "vendor_payments.edit_own", others: "vendor_payments.edit_others" });
  }
}
