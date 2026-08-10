import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { jobs, journalLines, accounts } from "../../db/schema";

export interface JobCostingReport {
  jobId: string;
  currency: string;
  contractValueAmount: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
}

/**
 * S-04.8 — "see cost, revenue and margin for a job as it runs." Per
 * CLAUDE.md's non-negotiable "job costing pulls from journal lines tagged
 * with job_id — don't build a shadow costing system" rule, this reads
 * directly off `journal_lines` filtered by `jobId`, joined to `accounts`
 * for each line's type (`income` credits = revenue recognised against this
 * job; `expense` debits = cost incurred against this job) — never a
 * separate running total maintained by application code.
 *
 * **Revenue side only, per the PRD's own Phase 3 scope** (`docs/spine-prd.md`
 * §12: "S-04.8 (revenue side only until Phase 4 supplies costs)") —
 * `journal_lines.jobId` is populated today only by
 * `InvoicesService.issue`'s revenue/retention/tax postings (this Phase),
 * since Purchases/Expenses (vendor bills, expenses — the modules that
 * would post `expense`-type debits tagged with a job) are still empty
 * `@Module({})` stubs until Phase 4. This query already sums `expense`-type
 * debits correctly — it will simply start returning nonzero `cost` the
 * moment Phase 4's VendorBills/Expenses services start posting with
 * `jobId` set, with no rework needed here.
 */
@Injectable()
export class JobCostingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async report(orgId: string, jobId: string): Promise<JobCostingReport> {
    const [job] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, jobId)));
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const lines = await this.db
      .select({ debit: journalLines.debit, credit: journalLines.credit, accountType: accounts.type })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.jobId, jobId));

    let revenue = 0n;
    let cost = 0n;
    for (const line of lines) {
      if (line.accountType === "income") revenue += line.credit;
      if (line.accountType === "expense") cost += line.debit;
    }

    const margin = revenue - cost;
    const marginPct = revenue > 0n ? Number((margin * 10000n) / revenue) / 100 : null;

    return {
      jobId,
      currency: job.currency,
      contractValueAmount: job.contractValueAmount.toString(),
      revenue: revenue.toString(),
      cost: cost.toString(),
      margin: margin.toString(),
      marginPct,
    };
  }
}
