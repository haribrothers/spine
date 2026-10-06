import { getMemberRole } from "../../auth/capability.util";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { BulkResult, createExpenseSchema, updateExpenseSchema } from "@spine/shared";
import { LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, labourLineAmount, labourTotal, toDecimalString, type LabourLineInput } from "@spine/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { expenses, expenseCategories, expenseLabourLines, accounts, invoiceLines, jobs, jobAssignments } from "../../db/schema";
import type { Transaction } from "../../db/client";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoicesService } from "../invoices/invoices.service";
import { orgLocale } from "../../common/money-format";
import { formatMoney } from "@spine/shared";
import { MoneyAccountsService } from "../banking/money-accounts.service";

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
  ) {}

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

    return this.db
      .select({ expense: expenses, categoryName: expenseCategories.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.createdAt))
      .then((rows) => rows.map((r) => ({ ...r.expense, categoryName: r.categoryName })));
  }

  /**
   * US-OPS-20 — Field users read only the expenses they submitted (07-security:
   * Field never reaches other people's money). Returns the user id to
   * restrict reads to, or undefined for Owners and Staff.
   */
  async readScope(orgId: string, userId: string): Promise<string | undefined> {
    return (await getMemberRole(this.db, orgId, userId)) === "field" ? userId : undefined;
  }

  /** `onlySubmittedBy` (from `readScope`) makes anyone else's expense a 404. */
  async getOne(orgId: string, id: string, onlySubmittedBy?: string) {
    const [row] = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
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
    return { ...row.expense, categoryName: row.categoryName, moneyAccount: row.expense.moneyAccountId ? (refs.get(row.expense.moneyAccountId) ?? null) : null, labourLines };
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
  async labourTrades(orgId: string, query?: string): Promise<{ trade: string; lastDayRateAmount: string }[]> {
    const q = query?.trim().toLowerCase();
    const rows = await this.db.execute<{ trade: string; day_rate_amount: string }>(sql`
      select distinct on (lower(${expenseLabourLines.trade})) ${expenseLabourLines.trade} as trade, ${expenseLabourLines.dayRateAmount}::text as day_rate_amount
      from ${expenseLabourLines}
      where ${expenseLabourLines.orgId} = ${orgId} ${q ? sql`and lower(${expenseLabourLines.trade}) like ${`%${q}%`}` : sql``}
      order by lower(${expenseLabourLines.trade}), ${expenseLabourLines.createdAt} desc
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
        changes: [{ field: "status", from: null, to: "submitted" }],
      });

      return expense;
    });

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
    if (existing.status !== "submitted") {
      throw new BadRequestException("Only a submitted expense can be edited");
    }
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
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id))
        .returning();
      if (mode === "labour" && input.labourLines) await this.writeLabourLines(tx, orgId, id, input.labourLines);
      if (mode === "amount" && existing.entryMode === "labour") await this.writeLabourLines(tx, orgId, id, []);

      // Labour rows aren't a field; the amount change already says what moved.
      const { labourLines: _rows, ...fields } = input;
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, fields as Record<string, unknown>);
      if (changes.length) {
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
   * CLAUDE.md), and a real "outstanding reimbursement" liability account
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

  async approve(orgId: string, id: string, actorUserId: string, comment: string | null, moneyAccountId?: string | null) {
    const [preCheck] = await this.db.select().from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Expense not found");
    }
    await this.refuseSelfReview(orgId, actorUserId, preCheck.submittedByUserId);

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
      const number = await this.numbering.allocateNumber(tx, orgId, "expense");
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
        changes: [{ field: "status", from: "submitted", to: "approved" }],
      });

      return row;
    });

    const amountText = formatMoney(result!.amount, result!.currency, await orgLocale(this.db, orgId));
    void this.notifications.notify(orgId, {
      subject: `Expense approved — ${category?.name ?? "Uncategorized"}`,
      text: `Expense ${result!.number} (${category?.name ?? "Uncategorized"}, ${amountText}) was approved.`,
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "expense_approved",
        message: `Expense approved — ${category?.name ?? "Uncategorized"}, ${amountText}`,
        link: `/expenses/${result!.id}`,
      },
    });

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
        changes: [{ field: "status", from: "submitted", to: "rejected" }],
      });

      return row;
    });

    return this.getOne(orgId, updated!.id);
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
