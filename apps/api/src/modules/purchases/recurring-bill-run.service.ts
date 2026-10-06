import { Inject, Injectable, Logger } from "@nestjs/common";
import { createVendorBillSchema, occurrenceAfter, scheduleFinished } from "@spine/shared";
import { and, asc, count, eq, lte } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, recurringBillLines, recurringBills, vendorBills } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { NotificationsService } from "../notifications/notifications.service";
import { RECURRING_RUN_AT } from "../invoices/recurring-invoice-run.service";
import { VendorBillsService } from "./vendor-bills.service";

type ScheduleRow = typeof recurringBills.$inferSelect;

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
 * US-PUR-30 (D-159) — turns due recurring bills into bills. From 6:00 AM
 * organisation time, every active schedule gets a bill for each run date
 * that has come — once each and in order, so a server that was off on the
 * day catches up every missed bill (rent is owed for each month). Each bill
 * is dated its run date, made from the schedule's lines through the same
 * `VendorBillsService.create` / `record` as a manual bill, and carries
 * (`recurring_bill_id`, `recurring_run_on`), unique together, so a late,
 * repeated or racing run never makes a second bill for one date.
 */
@Injectable()
export class RecurringBillRunService {
  private readonly logger = new Logger(RecurringBillRunService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly bills: VendorBillsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Called every 15 minutes; does nothing before 6:00 AM organisation time. */
  async runDue(now: Date = new Date()): Promise<{ created: string[] }> {
    const { date: today, time } = orgClock(now);
    if (time < RECURRING_RUN_AT) return { created: [] };
    const due = await this.db
      .select()
      .from(recurringBills)
      .where(and(eq(recurringBills.status, "active"), lte(recurringBills.nextRunOn, today)))
      .orderBy(asc(recurringBills.nextRunOn));
    const created: string[] = [];
    for (const schedule of due) {
      try {
        created.push(...(await this.catchUp(schedule, today)));
      } catch (err) {
        this.logger.error(`Recurring bill ${schedule.id} failed to run`, err instanceof Error ? err.stack : String(err));
      }
    }
    return { created };
  }

  /** Every run date up to today, in order, then the schedule's next date after today (or Finished). */
  async catchUp(schedule: ScheduleRow, today: string): Promise<string[]> {
    const created: string[] = [];
    let current: ScheduleRow | undefined = schedule;
    while (current && current.status === "active" && current.nextRunOn && current.nextRunOn <= today) {
      const id = await this.runOnce(current, current.nextRunOn);
      if (id) created.push(id);
      current = await this.advance(current, current.nextRunOn);
    }
    return created;
  }

  /** Creates the bill for one run date (once). Returns its id, or null if it already existed. */
  private async runOnce(schedule: ScheduleRow, runOn: string): Promise<string | null> {
    const actorUserId = schedule.createdByUserId ?? (await this.primaryOwner(schedule.orgId));
    if (!actorUserId) throw new Error("The organisation has no owner to create the bill as.");
    const lines = await this.db.select().from(recurringBillLines).where(eq(recurringBillLines.recurringBillId, schedule.id)).orderBy(asc(recurringBillLines.sortOrder));
    let billId: string | null = null;
    try {
      const bill = await this.bills.create(
        schedule.orgId,
        actorUserId,
        createVendorBillSchema.parse({
          contactId: schedule.contactId,
          billNumber: `${schedule.name} · ${runOn}`,
          date: runOn,
          dueDate: plusDays(runOn, schedule.dueDays),
          currency: schedule.currency,
          notes: `Created by Recurring bill ${schedule.name}`,
          lines: lines.map((l) => ({
            type: l.type,
            catalogItemId: l.catalogItemId,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPriceAmount: l.unitPriceAmount,
            accountId: l.accountId,
            taxRatePercentage: l.taxRatePercentage,
            taxRateId: l.taxRateId,
            taxGroupId: l.taxGroupId,
            isTaxInclusive: l.isTaxInclusive,
          })),
        }),
        false,
        { recurringBillId: schedule.id, recurringRunOn: runOn },
      );
      billId = bill.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Already created for this date by an earlier or concurrent run — just move the schedule on.
    }
    if (!billId) return null;

    let recorded = false;
    if (schedule.mode === "record") {
      try {
        await this.bills.record(schedule.orgId, billId, actorUserId);
        recorded = true;
      } catch (err) {
        // Left as a draft for an Owner to finish (e.g. a closed period), rather than blocking the schedule.
        this.logger.warn(`Recurring bill ${schedule.id}: bill ${billId} couldn't be recorded: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!recorded) {
      void this.notifications.notify(schedule.orgId, {
        subject: `Recurring bill ready to review: ${schedule.name}`,
        text: `Spine created a draft bill from the recurring bill "${schedule.name}". Check it and record it when it's right.`,
        recipientRoles: ["owner"],
        inApp: { type: "recurring_bill_draft", message: `Recurring bill ready to review: ${schedule.name}`, link: `/vendor-bills/${billId}` },
      });
    }
    return billId;
  }

  /** Moves the next date past `runOn` and marks the schedule finished once its end is reached. Returns the schedule as it now stands. */
  private async advance(schedule: ScheduleRow, runOn: string): Promise<ScheduleRow | undefined> {
    const [{ made }] = (await this.db.select({ made: count() }).from(vendorBills).where(eq(vendorBills.recurringBillId, schedule.id))) as [{ made: number }];
    const next = occurrenceAfter(schedule, runOn);
    const finished = scheduleFinished(next, schedule, made);
    const [updated] = await this.db
      .update(recurringBills)
      .set({ createdCount: made, nextRunOn: finished ? null : next, status: finished ? "finished" : "active", updatedAt: new Date() })
      .where(and(eq(recurringBills.id, schedule.id), eq(recurringBills.status, "active")))
      .returning();
    return updated;
  }

  private async primaryOwner(orgId: string): Promise<string | null> {
    const [owner] = await this.db
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.isPrimaryOwner, true)));
    return owner?.userId ?? null;
  }
}
