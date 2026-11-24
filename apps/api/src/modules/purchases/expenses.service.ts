import { moduleOn } from "../../common/modules";
import { getMemberRole, hasCapability } from "../../auth/capability.util";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { BulkResult, createExpenseSchema, ExpenseActivityEntry, PossibleDuplicateExpense, updateExpenseSchema } from "@spine/shared";
import { LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, RECEIPT_IN_USE, RECEIPT_UPLOAD_FIRST, labourLineAmount, labourTotal, toDecimalString, type LabourLineInput } from "@spine/shared";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { expenses, expenseCategories, expenseLabourLines, accounts, auditLog, invoiceLines, invoices, jobs, jobAssignments, user } from "../../db/schema";
import type { Transaction } from "../../db/client";
import { AuditLogService, aiMark } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "../invoices/invoices.service";
import { FilesService } from "../files/files.service";
import { orgLocale } from "../../common/money-format";
import { formatMoney } from "@spine/shared";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { attachmentCounts } from "../attachments/attachments.service";

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * PRD FEAT-07 (S-07.2/S-07.3 submit, S-07.4 approve/reject, S-07.5 job
 * tagging, S-07.6 billable). The PRD's own acceptance highlight for F7 is
 * the load-bearing rule this whole service is built around: "an
 * unapproved expense does not post to the ledger. Approval is the posting
 * trigger." — there is deliberately no separate "post" action; `approve()`
 * both flips `status -> approved` AND posts the §7.2 "Expense paid
 * directly" journal entry in the SAME transaction, so there is no
 * reachable approved-but-unposted state, matching InvoicesService.issue's
 * exact transaction-boundary discipline (row-lock, status re-check,
 * numbering, posting, audit log, all atomic).
 */
/** US-PUR-20 — why a Staff member can't review their own expense. */
export const SELF_REVIEW_MESSAGE = "Someone else needs to approve your own expense.";

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly invoices: InvoicesService,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly files: FilesService,
  ) {}

  /**
   * D-250 — a receipt must be a file this person uploaded that nothing else
   * uses yet (an expense keeps its own), the rule attachments follow
   * (US-OPS-33). Files are read by whoever can read the record they belong
   * to, so otherwise anyone could put a file they may not read — a
   * customer's signature, another record's attachment — onto their own
   * expense and read it through it.
   */
  private async checkReceipt(orgId: string, actorUserId: string, fileId: string, expenseId?: string) {
    await this.files.assertLinkable(orgId, actorUserId, fileId, { uploadFirst: RECEIPT_UPLOAD_FIRST, inUse: RECEIPT_IN_USE, keep: (o) => o.type === "expense_receipt" && o.id === expenseId });
  }

  /** US-PUR-22 — whether a member is on a job's crew. */
  async isAssigned(orgId: string, userId: string, jobId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ jobId: jobAssignments.jobId })
      .from(jobAssignments)
      .where(and(eq(jobAssignments.orgId, orgId), eq(jobAssignments.userId, userId), eq(jobAssignments.jobId, jobId)));
    return !!row;
  }

  async list(orgId: string, options: { status?: string; jobId?: string; submittedByUserId?: string }) {
    const conditions = [eq(expenses.orgId, orgId)];
    if (options.status) conditions.push(eq(expenses.status, options.status as "submitted" | "approved" | "rejected"));
    if (options.jobId) conditions.push(eq(expenses.jobId, options.jobId));
    if (options.submittedByUserId) conditions.push(eq(expenses.submittedByUserId, options.submittedByUserId));

    const reviewer = alias(user, "reviewer");
    const submitter = alias(user, "submitter");
    const rows = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name, reviewerName: reviewer.name, submittedByName: submitter.name, jobName: jobs.name, billedInvoiceId: invoices.id, billedInvoiceNumber: invoices.number })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      // US-MOB-12: who approved or rejected it ("— Sarah Mendes" under a rejection).
      .leftJoin(reviewer, eq(reviewer.id, sql`coalesce(${expenses.rejectedByUserId}, ${expenses.approvedByUserId})`))
      // US-PUR-42: who submitted it, its job and the invoice it was billed on.
      .leftJoin(submitter, eq(submitter.id, expenses.submittedByUserId))
      .leftJoin(jobs, eq(jobs.id, expenses.jobId))
      .leftJoin(invoiceLines, eq(invoiceLines.id, expenses.billedOnInvoiceLineId))
      .leftJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(...conditions))
      .orderBy(desc(expenses.date), desc(expenses.createdAt));
    // US-OPS-33: the paperclip on the list.
    const counts = await attachmentCounts(this.db, orgId, "expense", rows.map((r) => r.expense.id));
    return rows.map((r) => ({
      ...r.expense,
      categoryName: r.categoryName,
      reviewerName: r.reviewerName ?? null,
      submittedByName: r.submittedByName ?? null,
      jobName: r.jobName ?? null,
      billedInvoiceId: r.billedInvoiceId ?? null,
      billedInvoiceNumber: r.billedInvoiceNumber ?? null,
      attachmentCount: counts.get(r.expense.id) ?? 0,
    }));
  }

  /**
   * US-OPS-20 — Field users read only the expenses they submitted (07-security:
   * Field never reaches other people's money). Returns the user id to
   * restrict reads to, or undefined for Owners and Staff.
   *
   * US-TEAM-30 (D-235): Staff whose Teams don't grant "See everyone's
   * expenses" read only their own too, as Field do.
   */
  async readScope(orgId: string, userId: string): Promise<string | undefined> {
    return (await hasCapability(this.db, { orgId, userId }, "expenses.view_others")) ? undefined : userId;
  }

  async isField(orgId: string, userId: string): Promise<boolean> {
    return (await getMemberRole(this.db, orgId, userId)) === "field";
  }

  /** `onlySubmittedBy` (from `readScope`) makes anyone else's expense a 404. */
  async getOne(orgId: string, id: string, onlySubmittedBy?: string) {
    const reviewer = alias(user, "reviewer");
    const submitter = alias(user, "submitter");
    const [row] = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name, accountId: expenseCategories.accountId, reviewerName: reviewer.name, submittedByName: submitter.name, jobName: jobs.name, billedInvoiceId: invoices.id, billedInvoiceNumber: invoices.number })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(reviewer, eq(reviewer.id, sql`coalesce(${expenses.rejectedByUserId}, ${expenses.approvedByUserId})`))
      .leftJoin(submitter, eq(submitter.id, expenses.submittedByUserId))
      .leftJoin(jobs, eq(jobs.id, expenses.jobId))
      .leftJoin(invoiceLines, eq(invoiceLines.id, expenses.billedOnInvoiceLineId))
      .leftJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(
        and(
          eq(expenses.orgId, orgId),
          eq(expenses.id, id),
          onlySubmittedBy ? eq(expenses.submittedByUserId, onlySubmittedBy) : undefined,
        ),
      );
    if (!row) {
      throw new NotFoundException("Expense not found");
    }
    // US-PUR-23: a labour expense's rows, in order.
    const labourLines =
      row.expense.entryMode === "labour"
        ? await this.db.select().from(expenseLabourLines).where(eq(expenseLabourLines.expenseId, id)).orderBy(asc(expenseLabourLines.sortOrder))
        : [];
    const refs = await this.moneyAccounts.refs(orgId, [row.expense.moneyAccountId]);
    // US-PUR-43: the account its category posts to.
    const [account] = row.accountId ? await this.db.select({ code: accounts.code, name: accounts.name }).from(accounts).where(eq(accounts.id, row.accountId)) : [];
    return {
      ...row.expense,
      categoryName: row.categoryName,
      categoryAccount: account ? `${account.code} ${account.name}` : null,
      reviewerName: row.reviewerName ?? null,
      submittedByName: row.submittedByName ?? null,
      jobName: row.jobName ?? null,
      billedInvoiceId: row.billedInvoiceId ?? null,
      billedInvoiceNumber: row.billedInvoiceNumber ?? null,
      moneyAccount: row.expense.moneyAccountId ? (refs.get(row.expense.moneyAccountId) ?? null) : null,
      labourLines,
    };
  }

  /**
   * US-PUR-43 (D-227) — what happened to the expense, newest first, from
   * the audit log: submitted, edited (what changed), rejected and approved
   * (with the comment), resubmitted, and billed (with the invoice). The
   * same access as `getOne`, so Field reads only their own.
   */
  async activity(orgId: string, id: string, onlySubmittedBy?: string): Promise<ExpenseActivityEntry[]> {
    const expense = await this.getOne(orgId, id, onlySubmittedBy);
    const rows = await this.db
      .select({ action: auditLog.action, changes: auditLog.changes, at: auditLog.createdAt, actorName: user.name })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "expense"), eq(auditLog.entityId, id)));
    const labels: Record<string, string> = { receiptFileId: "receipt", amount: "amount", taxAmount: "tax", categoryId: "category", jobId: "job", date: "date", description: "description", paidBy: "who paid", isBillable: "billable", entryMode: "entry", currency: "currency", moneyAccountId: "account", taxRateId: "tax rate" };
    const entries: ExpenseActivityEntry[] = [];
    for (const row of rows) {
      const changes = (Array.isArray(row.changes) ? row.changes : []) as { field: string; from: unknown; to: unknown }[];
      const comment = changes.find((c) => c.field === "reviewComment")?.to;
      const base = { at: new Date(row.at).toISOString(), actorName: row.actorName ?? null };
      if (row.action === "created") entries.push({ ...base, type: "submitted", ...aiMark(row.changes) });
      else if (row.action === "resubmitted") entries.push({ ...base, type: "resubmitted", ...aiMark(row.changes) });
      else if (row.action === "updated") {
        const what = [...new Set(changes.map((c) => labels[c.field]).filter(Boolean))];
        entries.push({ ...base, type: "edited", detail: what.length ? what.join(", ") : null, ...aiMark(row.changes) });
      } else if (row.action === "rejected") entries.push({ ...base, type: "rejected", detail: typeof comment === "string" ? comment : expense.status === "rejected" ? expense.reviewComment : null });
      else if (row.action === "approved") entries.push({ ...base, type: "approved", amount: expense.amount.toString(), detail: typeof comment === "string" ? comment : expense.reviewComment });
      else if (row.action === "billed") entries.push({ ...base, type: "billed", detail: expense.billedInvoiceNumber, linkId: expense.billedInvoiceId });
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  /**
   * US-PUR-44 — my own expenses (not rejected) with the same amount on the
   * same day: a warning before submitting one twice; it still submits.
   */
  async possibleDuplicates(orgId: string, userId: string, query: { amount: bigint; date: string; excludeId?: string }): Promise<PossibleDuplicateExpense[]> {
    const rows = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.orgId, orgId),
          eq(expenses.submittedByUserId, userId),
          eq(expenses.amount, query.amount),
          eq(expenses.date, new Date(`${query.date}T00:00:00Z`)),
          inArray(expenses.status, ["submitted", "approved"]),
          query.excludeId ? ne(expenses.id, query.excludeId) : undefined,
        ),
      )
      .orderBy(desc(expenses.createdAt))
      .limit(3);
    return rows.map((r) => ({
      id: r.expense.id,
      number: r.expense.number,
      date: new Date(r.expense.date).toISOString().slice(0, 10),
      amount: r.expense.amount.toString(),
      currency: r.expense.currency,
      categoryName: r.categoryName,
      status: r.expense.status,
    }));
  }

  /**
   * US-PUR-23 (D-126) — a labour expense needs a job and at least one row,
   * and its amount must be the rows' total (the server's sum, not the
   * client's arithmetic).
   */
  private checkLabour(input: { labourLines?: LabourLineInput[]; amount: bigint; jobId: string | null; currency: string }) {
    if (!input.labourLines?.length) throw new BadRequestException(LABOUR_ROW_INCOMPLETE);
    if (!input.jobId) throw new BadRequestException(LABOUR_NEEDS_JOB);
    const total = labourTotal(input.labourLines);
    if (total !== input.amount) {
      throw new BadRequestException(`The amount must equal the labour rows' total, ${toDecimalString({ amount: total, currency: input.currency })}.`);
    }
  }

  private async writeLabourLines(tx: Transaction, orgId: string, expenseId: string, lines: LabourLineInput[]) {
    await tx.delete(expenseLabourLines).where(eq(expenseLabourLines.expenseId, expenseId));
    if (!lines.length) return;
    await tx.insert(expenseLabourLines).values(
      lines.map((line, i) => ({ orgId, expenseId, sortOrder: i, trade: line.trade.trim(), headcount: line.headcount, dayRateAmount: line.dayRateAmount, lineAmount: labourLineAmount(line) })),
    );
  }

  /** US-PUR-23 — trades used before, with the last day rate for each, for the labour form's suggestions. */
  /**
   * `onlySubmittedBy` (from `readScope`): Field get only the trades and day
   * rates from their own expenses (US-MOB-13 "a trade I've used before";
   * 07-security: never other people's money).
   */
  async labourTrades(orgId: string, query?: string, onlySubmittedBy?: string): Promise<{ trade: string; lastDayRateAmount: string }[]> {
    const q = query?.trim().toLowerCase();
    // Each trade once, with its latest day rate; then the 20 used most recently (not the first 20
    // alphabetically, which hid every later trade once a business had used more than 20).
    const rows = await this.db.execute<{ trade: string; day_rate_amount: string }>(sql`
      select trade, day_rate_amount from (
        select distinct on (lower(${expenseLabourLines.trade})) ${expenseLabourLines.trade} as trade, ${expenseLabourLines.dayRateAmount}::text as day_rate_amount, ${expenseLabourLines.createdAt} as last_used
        from ${expenseLabourLines}
        where ${expenseLabourLines.orgId} = ${orgId} ${q ? sql`and lower(${expenseLabourLines.trade}) like ${`%${q}%`}` : sql``}
        ${onlySubmittedBy ? sql`and ${expenseLabourLines.expenseId} in (select ${expenses.id} from ${expenses} where ${expenses.submittedByUserId} = ${onlySubmittedBy})` : sql``}
        order by lower(${expenseLabourLines.trade}), ${expenseLabourLines.createdAt} desc
      ) as trades
      order by last_used desc
      limit 20`);
    return (rows as unknown as { trade: string; day_rate_amount: string }[]).map((r) => ({ trade: r.trade, lastDayRateAmount: r.day_rate_amount }));
  }

  /** `GET /expenses/:id/history` — confirms the expense exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string, onlySubmittedBy?: string) {
    await this.getOne(orgId, id, onlySubmittedBy);
    return this.auditLog.listForEntity(orgId, "expense", id);
  }

  async create(orgId: string, actorUserId: string, input: CreateExpenseInput, isDemo = false) {
    const [category] = await this.db
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.orgId, orgId), eq(expenseCategories.id, input.categoryId)));
    if (!category) {
      throw new BadRequestException("Expense category not found");
    }
    const labour = input.entryMode === "labour";
    if (labour) this.checkLabour({ labourLines: input.labourLines, amount: input.amount, jobId: input.jobId ?? null, currency: input.currency });

    if (input.receiptFileId) await this.checkReceipt(orgId, actorUserId, input.receiptFileId);

    // US-BANK-03: Field never chooses an account (they can't see them); theirs starts on the default and the approver can change it.
    const chosenAccountId = (await getMemberRole(this.db, orgId, actorUserId)) === "field" ? null : input.moneyAccountId;

    const created = await this.db.transaction(async (tx) => {
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, chosenAccountId);
      if (chosenAccountId && !isDemo) await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "expense", moneyAccount.id);
      const [expense] = await tx
        .insert(expenses)
        .values({
          orgId,
          categoryId: input.categoryId,
          jobId: input.jobId ?? null,
          date: input.date,
          currency: input.currency,
          amount: input.amount,
          taxAmount: input.taxAmount ?? 0n,
          taxRateId: input.taxRateId ?? null,
          description: input.description ?? null,
          paidBy: input.paidBy,
          moneyAccountId: moneyAccount.id,
          receiptFileId: input.receiptFileId ?? null,
          status: "submitted",
          submittedByUserId: actorUserId,
          isBillable: input.isBillable,
          entryMode: labour ? "labour" : "amount",
          // US-AI-06 (D-166)
          aiAssisted: input.aiAssisted === true,
          isDemo,
        })
        .returning();
      if (labour) await this.writeLabourLines(tx, orgId, expense!.id, input.labourLines!);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "expense",
        entityId: expense!.id,
        contactId: null,
        changes: [{ field: "status", from: null, to: "submitted" }, ...(input.aiAssisted ? [{ field: "aiAssisted", from: null, to: true }] : [])],
      });

      return expense;
    });

    // D-154: with Approvals switched off, a submitted expense is approved and posted at once by its submitter's save.
    if (!(await moduleOn(this.db, orgId, "approvals"))) await this.approve(orgId, created!.id, actorUserId, null, undefined, { approvalsOff: true });

    return this.getOne(orgId, created!.id);
  }

  /** Updates a SUBMITTED expense in place — an approved/rejected expense is immutable (approval already posted to the ledger; a rejected one is a closed review, resubmit as a new expense instead). */
  async update(orgId: string, id: string, actorUserId: string, input: UpdateExpenseInput) {
    const [existing] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!existing) {
      throw new NotFoundException("Expense not found");
    }
    await requireOwnershipCapability(
      this.db,
      { orgId, userId: actorUserId },
      existing.submittedByUserId,
      { own: "expenses.edit_own", others: "expenses.edit_others" },
      "own",
    );
    // US-PUR-45 (D-227): a rejected expense can be fixed and resubmitted; an approved one has posted and can't change.
    if (existing.status === "approved") {
      throw new BadRequestException("Only a waiting or rejected expense can be edited — an approved expense has already posted to the ledger.");
    }
    const resubmitting = existing.status === "rejected";
    // D-250: a new receipt follows the same rule as on create; keeping the current one is always fine.
    if (input.receiptFileId && input.receiptFileId !== existing.receiptFileId) await this.checkReceipt(orgId, actorUserId, input.receiptFileId, id);
    // US-PUR-23: switching mode or changing labour rows re-checks the whole labour entry.
    const mode = input.entryMode ?? existing.entryMode;
    const labourChanged = input.entryMode !== undefined || input.labourLines !== undefined;
    if (mode === "labour" && (labourChanged || input.amount !== undefined || input.jobId !== undefined)) {
      const currentLines =
        input.labourLines ??
        (await this.db.select().from(expenseLabourLines).where(eq(expenseLabourLines.expenseId, id)).orderBy(asc(expenseLabourLines.sortOrder))).map((l) => ({
          trade: l.trade,
          headcount: l.headcount,
          dayRateAmount: l.dayRateAmount,
        }));
      this.checkLabour({
        labourLines: currentLines,
        amount: input.amount ?? existing.amount,
        jobId: input.jobId !== undefined ? input.jobId : existing.jobId,
        currency: input.currency ?? existing.currency,
      });
    }

    const updated = await this.db.transaction(async (tx) => {
      const moneyAccount =
        input.moneyAccountId && (await getMemberRole(this.db, orgId, actorUserId)) !== "field" ? await this.moneyAccounts.requireActive(tx, orgId, input.moneyAccountId) : null;
      const [row] = await tx
        .update(expenses)
        .set({
          ...(moneyAccount ? { moneyAccountId: moneyAccount.id } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.taxAmount !== undefined ? { taxAmount: input.taxAmount } : {}),
          ...(input.taxRateId !== undefined ? { taxRateId: input.taxRateId } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.paidBy !== undefined ? { paidBy: input.paidBy } : {}),
          ...(input.receiptFileId !== undefined ? { receiptFileId: input.receiptFileId } : {}),
          ...(input.isBillable !== undefined ? { isBillable: input.isBillable } : {}),
          ...(input.entryMode !== undefined ? { entryMode: input.entryMode } : {}),
          ...(input.aiAssisted ? { aiAssisted: true } : {}),
          ...(resubmitting ? { status: "submitted" as const, rejectedByUserId: null, rejectedAt: null, reviewComment: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id))
        .returning();
      if (mode === "labour" && input.labourLines) await this.writeLabourLines(tx, orgId, id, input.labourLines);
      if (mode === "amount" && existing.entryMode === "labour") await this.writeLabourLines(tx, orgId, id, []);

      // Labour rows aren't a field; the amount change already says what moved.
      const { labourLines: _rows, aiAssisted: _ai, ...fields } = input;
      const changes = [...AuditLogService.diffFields(existing as unknown as Record<string, unknown>, fields as Record<string, unknown>), ...(input.aiAssisted ? [{ field: "aiAssisted", from: null, to: true }] : [])];
      if (resubmitting) {
        await this.auditLog.record(tx, { orgId, actorUserId, action: "resubmitted", entityType: "expense", entityId: id, contactId: null, changes: [{ field: "status", from: "rejected", to: "submitted" }, ...changes] });
      } else if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "expense",
          entityId: id,
          contactId: null,
          changes,
        });
      }

      return row;
    });

    return this.getOne(orgId, updated!.id);
  }

  /**
   * S-07.4's approve half — the posting trigger. §7.2 "Expense paid
   * directly": debit the category's own Expense account (falling back to
   * the org's default expense account, same 6900 fallback
   * VendorBillsService uses) + debit Input Tax Receivable if any tax,
   * credit Bank/Cash if `paidBy: "company"`. For `paidBy: "employee"`
   * (paid out of pocket, reimbursable), this v1 has no dedicated
   * employee-reimbursement liability account — crediting Bank/Cash would
   * be wrong (no cash actually left the business bank account yet) and
   * crediting Accounts Payable would conflate an employee reimbursement
   * with a vendor bill. The simplification taken: `paidBy: "employee"`
   * still credits Bank/Cash, treating the reimbursement as effectively
   * immediate/already-settled — correct once the employee is actually
   * paid back (typically same-day via petty cash or an immediate bank
   * transfer for a small business, this product's own target per
   * the architecture rules), and a real "outstanding reimbursement" liability account
   * is a natural Settings → Chart of Accounts addition (S-09.9) an org
   * can configure later if they need to track a lag between submission
   * and reimbursement — not invented here without a PRD story asking for it.
   */
  /**
   * US-PUR-20 (D-085) — nobody but an Owner reviews (approves or rejects)
   * their own expense. Runs before any status check.
   */
  private async refuseSelfReview(orgId: string, actorUserId: string, submittedByUserId: string | null): Promise<void> {
    if (submittedByUserId !== actorUserId) return;
    if ((await getMemberRole(this.db, orgId, actorUserId)) === "owner") return;
    throw new ForbiddenException(SELF_REVIEW_MESSAGE);
  }

  async approve(orgId: string, id: string, actorUserId: string, comment: string | null, moneyAccountId?: string | null, options: { approvalsOff?: boolean } = {}) {
    const [preCheck] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Expense not found");
    }
    // With Approvals off there's no review: the submitter's own save approves it (D-154).
    if (!options.approvalsOff) await this.refuseSelfReview(orgId, actorUserId, preCheck.submittedByUserId);

    const [category] = await this.db.select().from(expenseCategories).where(eq(expenseCategories.id, preCheck.categoryId));
    const resolvedExpenseAccountId = category?.accountId ?? (await this.resolveDefaultExpenseAccount(orgId));

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Expense not found");
      }
      if (existing.status !== "submitted") {
        throw new BadRequestException("Only a submitted expense can be approved");
      }

      // P15 credits the account the approver chose, else the one the expense carries, else the default (US-BANK-03).
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, moneyAccountId ?? existing.moneyAccountId);
      if (moneyAccountId) await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "expense", moneyAccount.id);
      const number = await this.numbering.allocateNumber(tx, orgId, "expense", { demo: existing.isDemo });
      const approvedAt = new Date();
      const dateStr = new Date(existing.date).toISOString().slice(0, 10);

      const postingLines: { accountId: string; debit: bigint; credit: bigint; jobId?: string | null }[] = [
        { accountId: resolvedExpenseAccountId, debit: existing.amount - existing.taxAmount, credit: 0n, jobId: existing.jobId },
      ];
      if (existing.taxAmount > 0n) {
        const inputTaxAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable");
        postingLines.push({ accountId: inputTaxAccountId, debit: existing.taxAmount, credit: 0n, jobId: existing.jobId });
      }
      postingLines.push({ accountId: moneyAccount.accountId, debit: 0n, credit: existing.amount, jobId: existing.jobId });

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: dateStr,
        narration: `Expense ${number} approved and posted`,
        sourceType: "expense",
        sourceId: id,
        lines: postingLines,
      });

      const [row] = await tx
        .update(expenses)
        .set({
          status: "approved",
          number,
          approvedByUserId: actorUserId,
          approvedAt,
          reviewComment: comment,
          moneyAccountId: moneyAccount.id,
          journalEntryId,
          updatedAt: approvedAt,
        })
        .where(eq(expenses.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "approved",
        entityType: "expense",
        entityId: id,
        contactId: null,
        // US-PUR-43: the comment stays with the approval in Activity.
        changes: [{ field: "status", from: "submitted", to: "approved" }, ...(comment ? [{ field: "reviewComment", from: null, to: comment }] : [])],
      });

      return row;
    });

    const amountText = formatMoney(result!.amount, result!.currency, await orgLocale(this.db, orgId));
    // The submitter gets their own "approved your expense" below, not the office's copy.
    const submitter = result!.submittedByUserId && result!.submittedByUserId !== actorUserId ? result!.submittedByUserId : null;
    void this.notifications.notify(orgId, {
      subject: `Expense approved — ${category?.name ?? "Uncategorized"}`,
      text: `Expense ${result!.number} (${category?.name ?? "Uncategorized"}, ${amountText}) was approved.`,
      recipientRoles: ["owner", "staff"],
      excludeUserIds: submitter ? [submitter] : undefined,
      inApp: {
        type: "expense_approved",
        message: `Expense approved — ${category?.name ?? "Uncategorized"}, ${amountText}`,
        link: `/expenses/${result!.id}`,
      },
    });
    if (submitter) await this.notifySubmitter(orgId, actorUserId, submitter, { id: result!.id, category: category?.name ?? "Uncategorized", amountText }, null);

    return this.getOne(orgId, result!.id);
  }

  /** S-07.4's reject half — a comment is required (per the story's own wording), and a rejected expense never posts. */
  /**
   * US-PUR-21 (D-097) — approves or rejects several expenses, one at a
   * time through `approve`/`reject`, so each is checked, numbered, posted
   * (its own journal entry) and notified exactly as a single review would
   * be. Any that can't be reviewed are reported with the reason.
   */
  async bulkReview(orgId: string, actorUserId: string, ids: string[], action: { approve: true } | { approve: false; comment: string }): Promise<BulkResult> {
    const result: BulkResult = { done: [], skipped: [] };
    for (const id of [...new Set(ids)]) {
      try {
        if (action.approve) await this.approve(orgId, id, actorUserId, null);
        else await this.reject(orgId, id, actorUserId, action.comment);
        result.done.push(id);
      } catch (err) {
        const reason =
          err instanceof NotFoundException
            ? "Not found."
            : err instanceof ForbiddenException
              ? "It's your own expense — someone else reviews it."
              : err instanceof BadRequestException && /Only a submitted expense/.test(err.message)
                ? "It isn't waiting for approval."
                : err instanceof Error
                  ? err.message
                  : "It couldn't be reviewed.";
        const [row] = await this.db.select({ number: expenses.number }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
        result.skipped.push({ id, label: row?.number ?? null, reason });
      }
    }
    return result;
  }

  async reject(orgId: string, id: string, actorUserId: string, comment: string) {
    const [existing] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!existing) {
      throw new NotFoundException("Expense not found");
    }
    await this.refuseSelfReview(orgId, actorUserId, existing.submittedByUserId);
    if (existing.status !== "submitted") {
      throw new BadRequestException("Only a submitted expense can be rejected");
    }

    const updated = await this.db.transaction(async (tx) => {
      const rejectedAt = new Date();
      const [row] = await tx
        .update(expenses)
        .set({ status: "rejected", rejectedByUserId: actorUserId, rejectedAt, reviewComment: comment, updatedAt: rejectedAt })
        .where(eq(expenses.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "rejected",
        entityType: "expense",
        entityId: id,
        contactId: null,
        // US-PUR-45: the reason stays in Activity after the expense is resubmitted.
        changes: [{ field: "status", from: "submitted", to: "rejected" }, { field: "reviewComment", from: null, to: comment }],
      });

      return row;
    });

    if (existing.submittedByUserId && existing.submittedByUserId !== actorUserId) {
      const [category] = await this.db.select({ name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.id, existing.categoryId));
      const amountText = formatMoney(existing.amount, existing.currency, await orgLocale(this.db, orgId));
      await this.notifySubmitter(orgId, actorUserId, existing.submittedByUserId, { id, category: category?.name ?? "Uncategorized", amountText }, comment);
    }

    return this.getOne(orgId, updated!.id);
  }

  /**
   * US-MOB-22 — tells the person who submitted an expense that it was
   * approved (`expense_approved`) or rejected with the reason
   * (`expense_rejected`): "Sarah Mendes rejected your expense", detail
   * "Fuel & Vehicle · $38.50 · “No receipt attached”".
   */
  private async notifySubmitter(orgId: string, actorUserId: string, submitterUserId: string, expense: { id: string; category: string; amountText: string }, rejectReason: string | null) {
    const [actor] = await this.db.select({ name: user.name }).from(user).where(eq(user.id, actorUserId));
    const who = actor?.name || "Your office";
    const rejected = rejectReason !== null;
    const verb = rejected ? "rejected" : "approved";
    const detail = [expense.category, expense.amountText, ...(rejected && rejectReason.trim() ? [`“${rejectReason.trim()}”`] : [])].join(" · ");
    await this.notifications.notify(orgId, {
      subject: `${who} ${verb} your expense`,
      text: `${who} ${verb} your expense (${detail}).`,
      recipientUserIds: [submitterUserId],
      inApp: { type: rejected ? "expense_rejected" : "expense_approved", message: `${who} ${verb} your expense`, detail, link: `/expenses/${expense.id}` },
    });
  }

  /**
   * S-07.6 — pulls a billable, approved expense into a customer invoice as
   * one new line, mirroring the exact snapshot-on-write shape
   * QuotesService/InvoicesService already use for a line's name/price
   * (name = the expense's own description or category name, unitPrice =
   * the expense's own amount inc. tax, quantity 1, no separate tax applied
   * here since the expense's own tax was already paid — this line
   * reimburses the gross amount, not a re-taxed amount). Only reachable
   * once per expense (`billedOnInvoiceLineId` is set on success) — see
   * expenses.ts's own doc comment on why a second attempt is rejected
   * rather than allowed like a quote's repeat conversion.
   *
   * Deliberately does NOT insert the invoice_lines row directly — that
   * would duplicate InvoicesService's own line-computation logic (tax,
   * totals) and risk drifting from it. Instead this returns the shaped
   * line data for InvoicesService.update (or a future dedicated
   * "add billable expense to invoice" convenience wrapper there) to
   * append, and the CALLER is responsible for setting
   * `billedOnInvoiceLineId` back onto this expense once the invoice write
   * actually lands one — see PurchasesController's own doc comment on how
   * the two calls compose into one user-facing action.
   */
  async markBilled(orgId: string, id: string, actorUserId: string, invoiceLineId: string) {
    const [existing] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!existing) {
      throw new NotFoundException("Expense not found");
    }
    if (existing.status !== "approved") {
      throw new BadRequestException("Only an approved expense can be marked billed");
    }
    if (!existing.isBillable) {
      throw new BadRequestException("This expense is not marked as billable");
    }
    if (existing.billedOnInvoiceLineId) {
      throw new BadRequestException("This expense has already been billed to a customer");
    }

    const [invoiceLine] = await this.db.select().from(invoiceLines).where(eq(invoiceLines.id, invoiceLineId));
    if (!invoiceLine) {
      throw new BadRequestException("Invoice line not found");
    }

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(expenses)
        .set({ billedOnInvoiceLineId: invoiceLineId, updatedAt: new Date() })
        .where(eq(expenses.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "billed",
        entityType: "expense",
        entityId: id,
        contactId: null,
        changes: [{ field: "billedOnInvoiceLineId", from: null, to: invoiceLineId }],
      });

      return row;
    });

    return this.getOne(orgId, updated!.id);
  }

  /**
   * S-07.6's actual one-click UI action — composes InvoicesService.create
   * (a brand-new DRAFT `standard` invoice, one line for this expense) with
   * markBilled above, mirroring MilestonesService.invoiceMilestone's exact
   * composition shape: this service owns the guard checks and the
   * two-write orchestration, InvoicesService owns invoice creation, each
   * keeping its own transaction boundary (matching every other
   * cross-service call in this codebase — see invoiceMilestone's own doc
   * comment on why that's fine, retry-safety is IdempotencyInterceptor at
   * the controller layer).
   *
   * An expense has no `contactId` of its own — only an optional `jobId` —
   * so this requires the expense to have a job attached (job.contactId is
   * who gets billed). An expense logged without a job has no unambiguous
   * customer to bill and is out of scope here, same as the web action
   * being disabled in that case.
   */
  async createInvoiceFromExpense(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!existing) {
      throw new NotFoundException("Expense not found");
    }
    if (existing.status !== "approved") {
      throw new BadRequestException("Only an approved expense can be billed to a customer");
    }
    if (!existing.isBillable) {
      throw new BadRequestException("This expense is not marked as billable");
    }
    if (existing.billedOnInvoiceLineId) {
      throw new BadRequestException("This expense has already been billed to a customer");
    }
    if (!existing.jobId) {
      throw new BadRequestException("This expense has no job attached — attach a job to bill its customer");
    }

    const [job] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, existing.jobId)));
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const [category] = await this.db.select().from(expenseCategories).where(eq(expenseCategories.id, existing.categoryId));

    const invoice = await this.invoices.create(orgId, actorUserId, {
      contactId: job.contactId,
      type: "standard",
      currency: existing.currency,
      issueDate: null,
      dueDate: null,
      notes: null,
      termsAndConditions: null,
      lines: [
        {
          type: "item",
          catalogItemId: null,
          // Gross amount (amount + tax) reimburses the expense as paid —
          // see markBilled's own doc comment on why no tax is re-applied.
          name: existing.description || category?.name || "Billable expense",
          description: null,
          quantity: 1,
          unitPriceAmount: existing.amount + existing.taxAmount,
          unitPriceCurrency: existing.currency,
          discountPercentage: 0,
          taxRatePercentage: 0,
          taxRateId: null,
          taxGroupId: null,
          isTaxInclusive: false,
        },
      ],
    });

    const line = invoice.lines[0];
    if (!line) {
      throw new BadRequestException("Failed to create the invoice line for this expense");
    }

    await this.markBilled(orgId, id, actorUserId, line.id);

    return this.invoices.getOne(orgId, invoice.id);
  }

  /** Only a submitted (never posted) expense can be hard-deleted — matches VendorBillsService.delete/InvoicesService.delete's exact posture. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!existing) {
      throw new NotFoundException("Expense not found");
    }
    await requireOwnershipCapability(
      this.db,
      { orgId, userId: actorUserId },
      existing.submittedByUserId,
      { own: "expenses.delete_own", others: "expenses.delete_others" },
      "own",
    );
    if (existing.status !== "submitted") {
      throw new BadRequestException("Only a submitted expense can be deleted");
    }

    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "expense",
        entityId: id,
        contactId: null,
        changes: [{ field: "status", from: existing.status, to: null }],
      });
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
    return { id };
  }

  private async resolveDefaultExpenseAccount(orgId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    if (!row) {
      throw new BadRequestException(
        "No default expense account found (expected code 6900, 'Other Expenses'). Assign an account to this expense's category or restore this account.",
      );
    }
    return row.id;
  }
}
