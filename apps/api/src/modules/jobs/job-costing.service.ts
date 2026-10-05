import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { billingFigures, budgetFigures, wholePercent, type BillingFigures, type BudgetFigures, type BudgetState } from "@spine/shared";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hasCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { creditNotes, invoices, jobs, journalEntries, journalLines, accounts } from "../../db/schema";

export interface JobCostingReport {
  jobId: string;
  currency: string;
  contractValueAmount: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
  /** US-JOB-25 — cost against the job's budget. */
  budget: BudgetFigures;
  /** US-JOB-26 — the cost split by the expense account it posted to, largest first; amounts add up to `cost` exactly. */
  byCategory: { accountId: string; code: string; name: string; amount: string; sharePct: number }[];
  /** US-JOB-27 — billed to date against the contract value. */
  billing: BillingFigures;
}

/** US-JOB-25 — what the Jobs list adds per job for members who may see job profitability. */
export interface JobCostingSummary {
  budgetUsedPct: number | null;
  budgetState: BudgetState;
  /** US-JOB-27 */
  billedPct: number | null;
}

/**
 * US-JOB-27 (D-127) — billed to date per job: the net of 1100 AR and 1150
 * Retention Receivable lines tagged to the job from invoice, invoice-void
 * and credit-note entries, leaving out retention-release invoices (and
 * credits against them). Advance invoices post nothing at issue, so a
 * deposit only counts once it's offset on a progress invoice.
 */
export async function billedByJob(db: Database, orgId: string, jobIds: string[]): Promise<Map<string, bigint>> {
  if (!jobIds.length) return new Map();
  const sourceInvoice = alias(invoices, "source_invoice");
  const creditedInvoice = alias(invoices, "credited_invoice");
  const rows = await db
    .select({ jobId: journalLines.jobId, billed: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .leftJoin(sourceInvoice, and(inArray(journalEntries.sourceType, ["invoice", "invoice_void"]), eq(sourceInvoice.id, journalEntries.sourceId)))
    .leftJoin(creditNotes, and(eq(journalEntries.sourceType, "credit_note"), eq(creditNotes.id, journalEntries.sourceId)))
    .leftJoin(creditedInvoice, eq(creditedInvoice.id, creditNotes.invoiceId))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        inArray(journalLines.jobId, jobIds),
        inArray(accounts.code, ["1100", "1150"]),
        inArray(journalEntries.sourceType, ["invoice", "invoice_void", "credit_note"]),
        or(sql`coalesce(${sourceInvoice.type}, ${creditedInvoice.type}) is null`, ne(sql`coalesce(${sourceInvoice.type}, ${creditedInvoice.type})`, "retention_release")),
      ),
    )
    .groupBy(journalLines.jobId);
  return new Map(rows.map((r) => [r.jobId!, BigInt(r.billed)]));
}

/** Cost per job (expense debits tagged to it), for many jobs in one query. */
export async function costByJob(db: Database, jobIds: string[]): Promise<Map<string, bigint>> {
  if (!jobIds.length) return new Map();
  const rows = await db
    .select({ jobId: journalLines.jobId, cost: sql<string>`coalesce(sum(${journalLines.debit}), 0)` })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(inArray(journalLines.jobId, jobIds), eq(accounts.type, "expense")))
    .groupBy(journalLines.jobId);
  return new Map(rows.map((r) => [r.jobId!, BigInt(r.cost)]));
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
 * **Revenue side only, per the PRD's own Phase 3 scope** (`docs/archive/spine-prd.md`
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
      .select({ debit: journalLines.debit, credit: journalLines.credit, accountType: accounts.type, accountId: accounts.id, code: accounts.code, name: accounts.name })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.jobId, jobId));

    let revenue = 0n;
    let cost = 0n;
    const byAccount = new Map<string, { accountId: string; code: string; name: string; amount: bigint }>();
    for (const line of lines) {
      if (line.accountType === "income") revenue += line.credit;
      if (line.accountType === "expense" && line.debit > 0n) {
        cost += line.debit;
        const row = byAccount.get(line.accountId) ?? { accountId: line.accountId, code: line.code, name: line.name, amount: 0n };
        row.amount += line.debit;
        byAccount.set(line.accountId, row);
      }
    }
    const byCategory = [...byAccount.values()]
      .sort((a, b) => (a.amount === b.amount ? a.code.localeCompare(b.code) : a.amount > b.amount ? -1 : 1))
      .map((r) => ({ accountId: r.accountId, code: r.code, name: r.name, amount: r.amount.toString(), sharePct: wholePercent(r.amount, cost) ?? 0 }));

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
      budget: budgetFigures(job.costBudgetAmount, cost),
      byCategory,
      billing: billingFigures(job.contractValueAmount, (await billedByJob(this.db, orgId, [jobId])).get(jobId) ?? 0n, job.percentComplete),
    };
  }

  /**
   * `GET /jobs?include=costing` — adds `budgetUsedPct` and `budgetState` to
   * each job, only for members with `reports.view_job_profitability`;
   * everyone else gets the rows unchanged.
   */
  async withCosting<T extends { id: string; costBudgetAmount?: bigint | null; contractValueAmount: bigint }>(orgId: string, userId: string, rows: T[]): Promise<(T | (T & JobCostingSummary))[]> {
    if (!(await hasCapability(this.db, { orgId, userId }, "reports.view_job_profitability"))) return rows;
    const ids = rows.map((r) => r.id);
    const [costs, billed] = await Promise.all([costByJob(this.db, ids), billedByJob(this.db, orgId, ids)]);
    return rows.map((row) => {
      const budget = budgetFigures(row.costBudgetAmount ?? null, costs.get(row.id) ?? 0n);
      const billing = billingFigures(row.contractValueAmount, billed.get(row.id) ?? 0n);
      return { ...row, budgetUsedPct: budget.usedPct, budgetState: budget.state, billedPct: billing.billedPct };
    });
  }
}
