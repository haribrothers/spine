import { Inject, Injectable, Logger } from "@nestjs/common";
import { DEFAULT_INVOICE_REMINDERS, invoiceRemindersSchema, reminderDays, type InvoiceReminders } from "@spine/shared";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, invoiceReminders, invoices, settings } from "../../db/schema";
import { daysBetween, orgClock } from "../../common/org-clock";
import { AuditLogService } from "../audit/audit-log.service";
import { QueueService } from "../queue/queue.service";
import { INVOICE_SEND_EMAIL_QUEUE } from "./invoice-email.worker";
import { loadEmailBrand } from "../email/email-brand";
import { EMAIL_LOGO_CID, renderEmail } from "../email/email-layout";
import { invoiceEmail } from "../email/email-templates";

const DAY = 24 * 60 * 60 * 1000;
/** Where the last completed daily run's date is kept, so a day runs once however often the job fires. */
const LAST_RUN_KEY = "invoice_reminders_last_run";

/**
 * US-INV-18 / US-INV-19 (D-091) — automatic payment reminders: the
 * settings preview, and the daily run that sends them.
 */
@Injectable()
export class InvoiceRemindersService {
  private readonly logger = new Logger(InvoiceRemindersService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * US-INV-19 — called every 15 minutes. For each organisation with
   * reminders on, once its "Send at" time has passed and today hasn't run
   * yet, sends today's reminders. A server that was off at send time runs
   * the day once when it comes back; missed days aren't back-filled.
   */
  async runDue(now: Date = new Date()): Promise<void> {
    const { date, time } = orgClock(now);
    const rows = await this.db.select({ orgId: settings.orgId, value: settings.value }).from(settings).where(eq(settings.key, "invoice_reminders"));
    for (const row of rows) {
      const parsed = invoiceRemindersSchema.safeParse({ ...DEFAULT_INVOICE_REMINDERS, ...(row.value as object) });
      if (!parsed.success || !parsed.data.enabled || time < parsed.data.sendAt) continue;
      const [last] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, row.orgId), eq(settings.key, LAST_RUN_KEY)));
      if ((last?.value as { date?: string } | undefined)?.date === date) continue;
      try {
        await this.runForOrg(row.orgId, date, parsed.data);
        await this.db
          .insert(settings)
          .values({ orgId: row.orgId, key: LAST_RUN_KEY, value: { date } })
          .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { date } } });
      } catch (err) {
        this.logger.error(`Reminder run failed for org ${row.orgId}`, err instanceof Error ? err.stack : String(err));
      }
    }
  }

  /**
   * Sends one reminder to each issued invoice with a balance whose due date
   * is a scheduled number of days from `today`, skipping paused contacts.
   * The (invoice, day) unique index means an invoice already reminded today
   * — automatically or by hand — gets nothing more.
   */
  async runForOrg(orgId: string, today: string, config: InvoiceReminders): Promise<{ sent: string[] }> {
    const days = new Set(reminderDays(config));
    const balance = sql<bigint>`${invoices.totalAmount} - ${invoices.retentionAmount} - ${invoices.amountPaid} - ${invoices.creditedAmount}`;
    const candidates = await this.db
      .select({ id: invoices.id, dueDate: invoices.dueDate, contactId: invoices.contactId })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), isNotNull(invoices.dueDate), sql`${balance} > 0`, eq(contacts.remindersPaused, false)));

    const sent: string[] = [];
    for (const invoice of candidates) {
      const due = typeof invoice.dueDate === "string" ? invoice.dueDate : new Date(invoice.dueDate!).toISOString().slice(0, 10);
      const daysOverdue = daysBetween(due, today);
      if (!days.has(daysOverdue)) continue;
      const recorded = await this.db.transaction(async (tx) => {
        const [row] = await tx.insert(invoiceReminders).values({ orgId, invoiceId: invoice.id, sentOn: today, kind: "auto" }).onConflictDoNothing().returning({ id: invoiceReminders.id });
        if (!row) return false;
        await this.auditLog.record(tx, { orgId, actorUserId: null, action: "automatic_reminder_sent", entityType: "invoice", entityId: invoice.id, contactId: invoice.contactId, changes: [] });
        return true;
      });
      if (!recorded) continue;
      await this.queue.send(INVOICE_SEND_EMAIL_QUEUE, { orgId, invoiceId: invoice.id, isReminder: true, daysOverdue });
      sent.push(invoice.id);
    }
    return { sent };
  }

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
