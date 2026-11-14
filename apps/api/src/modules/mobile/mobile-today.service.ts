import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { expenses, jobAssignments, jobPhotos, jobs, milestones } from "../../db/schema";
import { loadModules } from "../../common/modules";
import { orgClock, orgTimeZone } from "../../common/org-clock";
import { orgMoneySettings } from "../../common/money-format";

export const TODAY_PERIODS = ["week", "month", "year"] as const;
export type TodayPeriod = (typeof TODAY_PERIODS)[number];

/** `YYYY-MM-DD` arithmetic on calendar dates, in UTC so no time zone shifts the day. */
function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The calendar week (Monday to Sunday), month or year that contains `today`. */
export function periodBounds(today: string, period: TodayPeriod): { from: string; to: string } {
  if (period === "week") {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const from = shift(today, -weekday);
    return { from, to: shift(from, 6) };
  }
  if (period === "month") {
    const from = `${today.slice(0, 7)}-01`;
    const next = new Date(`${from}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from, to: shift(next.toISOString().slice(0, 10), -1) };
  }
  return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
}

const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const isoDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * US-MOB-03 — the figures on the phone's Today for one period: milestones
 * on the caller's assigned jobs (done of total for the gauge, due, overdue),
 * photos they took, and their own expenses. Never any other money (D-048).
 * Jobs figures are null while Jobs & field is off (D-198).
 */
@Injectable()
export class MobileTodayService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async summary(orgId: string, userId: string, period: TodayPeriod, now: Date = new Date()) {
    const today = orgClock(now).date;
    const { from, to } = periodBounds(today, period);
    const modules = await loadModules(this.db, orgId);
    const money = await orgMoneySettings(this.db, orgId);

    const [jobFigures, mine] = await Promise.all([
      modules.jobsField ? this.jobFigures(orgId, userId, today, from, to) : Promise.resolve(null),
      this.expenseFigures(orgId, userId, from, to),
    ]);

    return {
      period,
      today,
      from,
      to,
      milestones: jobFigures?.milestones ?? null,
      photos: jobFigures?.photos ?? null,
      expenses: { ...mine, currency: money.currency },
    };
  }

  private async jobFigures(orgId: string, userId: string, today: string, from: string, to: string) {
    const myJobs = this.db
      .select({ id: jobAssignments.jobId })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(and(eq(jobs.orgId, orgId), eq(jobAssignments.userId, userId), ne(jobs.status, "cancelled")));
    const completedOn = sql<string>`(${milestones.completedAt} at time zone ${orgTimeZone()})::date`;

    const pending = await this.db
      .select({ dueDate: milestones.dueDate })
      .from(milestones)
      .where(and(eq(milestones.orgId, orgId), inArray(milestones.jobId, myJobs), eq(milestones.status, "pending"), lte(milestones.dueDate, asDate(to))));
    const [completed] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(milestones)
      .where(and(eq(milestones.orgId, orgId), inArray(milestones.jobId, myJobs), ne(milestones.status, "pending"), sql`${completedOn} between ${from} and ${to}`));
    const [photos] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobPhotos)
      .where(
        and(
          eq(jobPhotos.orgId, orgId),
          eq(jobPhotos.uploadedByUserId, userId),
          isNull(jobPhotos.removedAt),
          sql`(${jobPhotos.createdAt} at time zone ${orgTimeZone()})::date between ${from} and ${to}`,
        ),
      );

    const dates = pending.map((m) => isoDate(m.dueDate)).filter((d): d is string => d !== null);
    const due = dates.filter((d) => d >= today).sort();
    const overdue = dates.filter((d) => d < today).sort();
    const inPeriod = dates.filter((d) => d >= from).length;
    const done = completed?.count ?? 0;

    return {
      milestones: {
        done,
        total: done + inPeriod,
        due: due.length,
        nextDueDate: due[0] ?? null,
        overdue: overdue.length,
        oldestOverdueDate: overdue[0] ?? null,
      },
      photos: { taken: photos?.count ?? 0 },
    };
  }

  private async expenseFigures(orgId: string, userId: string, from: string, to: string) {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${expenses.amount}), 0)::text`,
        count: sql<number>`count(*)::int`,
        awaitingApproval: sql<number>`count(*) filter (where ${expenses.status} = 'submitted')::int`,
      })
      .from(expenses)
      .where(and(eq(expenses.orgId, orgId), eq(expenses.submittedByUserId, userId), ne(expenses.status, "rejected"), gte(expenses.date, asDate(from)), lt(expenses.date, asDate(shift(to, 1)))));
    return { total: row?.total ?? "0", count: row?.count ?? 0, awaitingApproval: row?.awaitingApproval ?? 0 };
  }
}
