import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { formatMoney, inputTaxOverMessage, type CreateTaxPaymentInput, type CreateTaxRefundInput, type TaxPayment } from "@spine/shared";
import { orgMoneySettings } from "../../common/money-format";
import { orgClock } from "../../common/org-clock";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { journalEntries, journalLines, moneyAccounts, taxPayments } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { LedgerService, type PostingLine } from "../ledger/ledger.service";

/** The entries a tax payment or refund posts; the Tax Summary leaves them out so settling tax never changes what was collected or paid. */
export const TAX_SETTLEMENT_SOURCES = ["tax_payment", "tax_refund", "tax_payment_delete"] as const;

/**
 * US-TAX-08 (D-143) — paying tax to the authority and getting it back.
 * A payment posts P26: Dr 2100 Output Tax Payable (paid + input tax used) /
 * Cr 1200 Input Tax Receivable (input tax used) and the money account
 * (paid). A refund posts P27: Dr the money account / Cr 1200. Neither can
 * take more from 1200 than it holds on the date (D-175).
 */
@Injectable()
export class TaxPaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly ledger: LedgerService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** The debit balance of 1200 Input Tax Receivable at the end of `date`: the input tax there is to use or claim back. */
  async inputTaxAvailable(orgId: string, date: string, db: Database | Transaction = this.db): Promise<bigint> {
    const inputTax = await this.ledger.resolveSystemAccount(db, orgId, "inputTaxReceivable");
    const [row] = await db
      .select({ balance: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalEntries.orgId, orgId), eq(journalLines.accountId, inputTax), lte(journalEntries.date, date)));
    const balance = BigInt(row?.balance ?? "0");
    return balance > 0n ? balance : 0n;
  }

  async list(orgId: string, from?: string, to?: string): Promise<TaxPayment[]> {
    const inRange = from && to ? or(and(gte(taxPayments.date, from), lte(taxPayments.date, to)), and(lte(taxPayments.periodFrom, to), gte(taxPayments.periodTo, from))) : undefined;
    const rows = await this.db
      .select({ row: taxPayments, moneyAccountName: moneyAccounts.name })
      .from(taxPayments)
      .leftJoin(moneyAccounts, eq(moneyAccounts.id, taxPayments.moneyAccountId))
      .where(and(eq(taxPayments.orgId, orgId), inRange))
      .orderBy(desc(taxPayments.date), desc(taxPayments.createdAt));
    return rows.map((r) => this.toResponse(r.row, r.moneyAccountName));
  }

  async recordPayment(orgId: string, actorUserId: string, input: CreateTaxPaymentInput): Promise<TaxPayment> {
    return this.db.transaction(async (tx) => {
      await this.lockOrg(tx, orgId);
      await this.requireInputTax(tx, orgId, input.date, input.inputTaxUsed);
      const moneyAccount = input.amount > 0n ? await this.moneyAccounts.requireActive(tx, orgId, input.moneyAccountId!) : null;
      const [outputTax, inputTax] = await Promise.all([
        this.ledger.resolveSystemAccount(tx, orgId, "outputTaxPayable"),
        this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable"),
      ]);
      const id = randomUUID();
      const lines: PostingLine[] = [
        { accountId: outputTax, debit: input.amount + input.inputTaxUsed, credit: 0n },
        ...(input.inputTaxUsed > 0n ? [{ accountId: inputTax, debit: 0n, credit: input.inputTaxUsed }] : []),
        ...(moneyAccount ? [{ accountId: moneyAccount.accountId, debit: 0n, credit: input.amount }] : []),
      ];
      const entryId = await this.ledger.postEntry(tx, { orgId, date: input.date, narration: `Tax payment for ${input.periodFrom} to ${input.periodTo}`, sourceType: "tax_payment", sourceId: id, lines });
      const [row] = await tx
        .insert(taxPayments)
        .values({ id, orgId, kind: "payment", periodFrom: input.periodFrom, periodTo: input.periodTo, inputTaxUsed: input.inputTaxUsed, amount: input.amount, moneyAccountId: moneyAccount?.id ?? null, date: input.date, reference: input.reference, entryId, createdByUserId: actorUserId })
        .returning();
      if (moneyAccount) await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "tax_payment", moneyAccount.id);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "tax_payment",
        entityId: id,
        contactId: null,
        changes: { kind: "payment", period: `${input.periodFrom} – ${input.periodTo}`, inputTaxUsed: input.inputTaxUsed.toString(), amount: input.amount.toString(), date: input.date },
      });
      return this.toResponse(row!, moneyAccount?.name ?? null);
    });
  }

  async recordRefund(orgId: string, actorUserId: string, input: CreateTaxRefundInput): Promise<TaxPayment> {
    return this.db.transaction(async (tx) => {
      await this.lockOrg(tx, orgId);
      await this.requireInputTax(tx, orgId, input.date, input.amount);
      const moneyAccount = await this.moneyAccounts.requireActive(tx, orgId, input.moneyAccountId);
      const inputTax = await this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable");
      const id = randomUUID();
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: "Tax refund",
        sourceType: "tax_refund",
        sourceId: id,
        lines: [
          { accountId: moneyAccount.accountId, debit: input.amount, credit: 0n },
          { accountId: inputTax, debit: 0n, credit: input.amount },
        ],
      });
      const [row] = await tx
        .insert(taxPayments)
        .values({ id, orgId, kind: "refund", amount: input.amount, moneyAccountId: moneyAccount.id, date: input.date, reference: input.reference, entryId, createdByUserId: actorUserId })
        .returning();
      await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "tax_payment", moneyAccount.id);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "tax_payment", entityId: id, contactId: null, changes: { kind: "refund", amount: input.amount.toString(), date: input.date } });
      return this.toResponse(row!, moneyAccount.name);
    });
  }

  /** Deleting posts the reversal, dated today, and keeps the row marked deleted. */
  async remove(orgId: string, actorUserId: string, id: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(taxPayments).where(and(eq(taxPayments.orgId, orgId), eq(taxPayments.id, id))).for("update");
      if (!existing) throw new NotFoundException("Tax payment not found");
      if (existing.deletedAt) throw new BadRequestException(`This tax ${existing.kind} has already been deleted.`);
      const reversalEntryId = await this.ledger.reverseEntry(tx, existing.entryId, {
        orgId,
        date: orgClock().date,
        narration: existing.kind === "payment" ? "Tax payment deleted" : "Tax refund deleted",
        sourceType: "tax_payment_delete",
        sourceId: id,
      });
      await tx.update(taxPayments).set({ deletedAt: new Date(), reversalEntryId, updatedAt: new Date() }).where(eq(taxPayments.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "tax_payment", entityId: id, contactId: null, changes: { kind: existing.kind, amount: existing.amount.toString() } });
    });
    return { id };
  }

  /** One tax payment or refund at a time per organisation, so two can't both use the same input tax. */
  private async lockOrg(tx: Transaction, orgId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`tax_payments:${orgId}`}))`);
  }

  private async requireInputTax(tx: Transaction, orgId: string, date: string, wanted: bigint) {
    if (wanted === 0n) return;
    const available = await this.inputTaxAvailable(orgId, date, tx);
    if (wanted > available) {
      const { currency, locale } = await orgMoneySettings(this.db, orgId);
      throw new BadRequestException(inputTaxOverMessage(formatMoney(available, currency, locale)));
    }
  }

  private toResponse(row: typeof taxPayments.$inferSelect, moneyAccountName: string | null): TaxPayment {
    return {
      id: row.id,
      kind: row.kind,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      inputTaxUsed: row.inputTaxUsed.toString(),
      amount: row.amount.toString(),
      moneyAccount: row.moneyAccountId ? { id: row.moneyAccountId, name: moneyAccountName ?? "" } : null,
      date: row.date,
      reference: row.reference,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }
}
