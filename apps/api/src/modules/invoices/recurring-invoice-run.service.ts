import { Inject, Injectable, Logger } from "@nestjs/common";
import { createInvoiceSchema, occurrenceAfter, scheduleFinished } from "@spine/shared";
import { and, asc, count, eq, lte } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, member, recurringInvoiceLines, recurringInvoices } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "./invoices.service";

/** Runs happen from 6:00 AM organisation time (D-092). */
export const RECURRING_RUN_AT = "06:00";

type ScheduleRow = typeof recurringInvoices.$inferSelect;

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-INV-21 (D-092) — turns due recurring invoices into invoices. From 6:00
 * AM organisation time, every active schedule whose next date has come gets
 * one invoice, made from its lines with today's tax rates, through the same
 * `InvoicesService.create` / `issue` / `sendEmail` as a manual invoice (so
 * numbering, ledger posting and email are identical). The invoice carries
 * (`recurring_invoice_id`, `recurring_run_on`), unique together, so a late,
 * repeated or racing run never makes a second invoice for one date. A run
 * missed while the server was off catches up once: one invoice, then the
 * next date moves past today.
 */
@Injectable()
export class RecurringInvoiceRunService {
  private readonly logger = new Logger(RecurringInvoiceRunService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Called every 15 minutes; does nothing before 6:00 AM organisation time. */
  async runDue(now: Date = new Date()): Promise<{ created: string[] }> {
    const { date: today, time } = orgClock(now);
    if (time < RECURRING_RUN_AT) return { created: [] };
    const due = await this.db
      .select()
      .from(recurringInvoices)
      .where(and(eq(recurringInvoices.status, "active"), lte(recurringInvoices.nextRunOn, today)))
      .orderBy(asc(recurringInvoices.nextRunOn));
    const created: string[] = [];
    for (const schedule of due) {
      try {
        const id = await this.runSchedule(schedule, today);
        if (id) created.push(id);
      } catch (err) {
        this.logger.error(`Recurring invoice ${schedule.id} failed to run`, err instanceof Error ? err.stack : String(err));
      }
    }
    return { created };
  }

  /** Creates the invoice for the schedule's next date (once), then moves the schedule on. Returns the new invoice's id, or null if it already existed. */
  async runSchedule(schedule: ScheduleRow, today: string): Promise<string | null> {
    const runOn = schedule.nextRunOn!;
    const actorUserId = schedule.createdByUserId ?? (await this.primaryOwner(schedule.orgId));
    const lines = await this.db.select().from(recurringInvoiceLines).where(eq(recurringInvoiceLines.recurringInvoiceId, schedule.id)).orderBy(asc(recurringInvoiceLines.sortOrder));

    let invoiceId: string | null = null;
    try {
      const invoice = await this.invoices.create(
        schedule.orgId,
        actorUserId,
        createInvoiceSchema.parse({
          contactId: schedule.contactId,
          currency: schedule.currency,
          issueDate: today,
          dueDate: plusDays(today, schedule.dueDays),
          lines: lines.map((l) => ({
            type: l.type,
            catalogItemId: l.catalogItemId,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPriceAmount: l.unitPriceAmount,
            discountPercentage: l.discountPercentage,
            taxRatePercentage: l.taxRatePercentage,
            taxRateId: l.taxRateId,
            taxGroupId: l.taxGroupId,
            isTaxInclusive: l.isTaxInclusive,
            supplyClass: l.supplyClass,
            hsnSac: l.hsnSac,
          })),
        }),
        false,
        undefined,
        { recurringInvoiceId: schedule.id, recurringRunOn: runOn },
      );
      invoiceId = invoice.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Already created for this date by an earlier or concurrent run — just move the schedule on.
    }

    if (invoiceId) {
      let issued = false;
      if (schedule.mode === "issue_and_email") {
        try {
          await this.invoices.issue(schedule.orgId, invoiceId, actorUserId);
          issued = true;
          await this.invoices.sendEmail(schedule.orgId, invoiceId, actorUserId);
        } catch (err) {
          // Left as a draft (or issued without its email) for an Owner to finish, rather than blocking the schedule.
          this.logger.warn(`Recurring invoice ${schedule.id}: invoice ${invoiceId} ${issued ? "was issued but its email couldn't be queued" : "couldn't be issued"}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (!issued) {
        void this.notifications.notify(schedule.orgId, {
          subject: `Recurring invoice ready to review: ${schedule.name}`,
          text: `Spine created a draft invoice from the recurring invoice "${schedule.name}". Review it and issue it when it's ready.`,
          recipientRoles: ["owner"],
          inApp: { type: "recurring_invoice_draft", message: `Recurring invoice ready to review: ${schedule.name}`, link: `/invoices/${invoiceId}` },
        });
      }
    }

    await this.advance(schedule, today);
    return invoiceId;
  }

  /** Moves the next date past today (missed dates aren't back-filled) and marks the schedule finished once its end is reached. */
  private async advance(schedule: ScheduleRow, today: string) {
    const [{ made }] = (await this.db.select({ made: count() }).from(invoices).where(eq(invoices.recurringInvoiceId, schedule.id))) as [{ made: number }];
    const next = occurrenceAfter(schedule, today);
    const finished = scheduleFinished(next, schedule, made);
    await this.db
      .update(recurringInvoices)
      .set({ createdCount: made, nextRunOn: finished ? null : next, status: finished ? "finished" : "active", updatedAt: new Date() })
      .where(and(eq(recurringInvoices.id, schedule.id), eq(recurringInvoices.status, "active")));
  }

  private async primaryOwner(orgId: string): Promise<string> {
    const [owner] = await this.db
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.isPrimaryOwner, true)));
    return owner!.userId;
  }
}
