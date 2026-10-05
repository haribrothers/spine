import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getMemberRole } from "../../auth/capability.util";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { jobAssignments, jobs } from "../../db/schema";

/** Fields Field users never receive on a job, a milestone or their history (D-072). */
export const JOB_MONEY_FIELDS = ["contractValueAmount", "retentionPct", "amount", "resolvedAmount", "costBudgetAmount"] as const;

type MoneyField = (typeof JOB_MONEY_FIELDS)[number];
type Redacted<T> = Omit<T, Extract<keyof T, MoneyField>>;

/** A job or milestone without its money fields. */
export function withoutMoney<T extends object>(row: T): Redacted<T> {
  const copy = { ...row } as Record<string, unknown>;
  for (const field of JOB_MONEY_FIELDS) delete copy[field];
  return copy as Redacted<T>;
}

/** History rows with any change to a money field taken out. */
export function historyWithoutMoney<T extends { changes: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    changes: Array.isArray(row.changes)
      ? (row.changes as { field?: string }[]).filter((change) => !JOB_MONEY_FIELDS.includes(change.field as MoneyField))
      : row.changes,
  }));
}

/**
 * US-JOB-19 (D-072) — Field users reach only the jobs they're assigned to,
 * and never a job's money. Owners and Staff are unaffected.
 */
@Injectable()
export class JobAccessService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Whether the caller is Field (so responses must be redacted). With a
   * `jobId`, a Field user who isn't assigned to that job gets a 404, the
   * same answer as a job that doesn't exist.
   */
  async check(orgId: string, userId: string, jobId?: string): Promise<{ field: boolean }> {
    if ((await getMemberRole(this.db, orgId, userId)) !== "field") return { field: false };
    if (jobId && !(await this.isAssigned(orgId, userId, jobId))) throw new NotFoundException("Job not found");
    return { field: true };
  }

  private async isAssigned(orgId: string, userId: string, jobId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobAssignments.id })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(and(eq(jobs.orgId, orgId), eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, userId)))
      .limit(1);
    return Boolean(row);
  }
}
