import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  type BankEntryDetails,
  CONTROL_ACCOUNT_CODES,
  CONTROL_ACCOUNT_HINT,
  MONEY_ACCOUNT_AS_CATEGORY,
  computeLineTax,
  money,
  type BankTransaction,
  type CreateBankTransactionInput,
} from "@spine/shared";
import { orgClock } from "../../common/org-clock";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, bankTransactions, contacts, journalLines, moneyAccounts, taxGroups, taxRates, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService, type PostingLine } from "../ledger/ledger.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { MoneyAccountsService } from "./money-accounts.service";

const CONTROL_CODES: ReadonlySet<string> = new Set(CONTROL_ACCOUNT_CODES);

/**
 * US-BANK-05 — money in or out that no document covers. Posts P22: money in
 * is Dr the money account / Cr the category; money out is Dr the category
 * (net) and 1200 Input Tax (any tax, backed out of the amount) / Cr the
 * money account. Control accounts move only through their own documents.
 */
@Injectable()
export class BankTransactionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly ledger: LedgerService,
    private readonly taxResolver: TaxResolverService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** `isDemo` (US-ONB-34): loaded by the demo — the row and its entry are demo data. */
  async create(orgId: string, actorUserId: string, input: CreateBankTransactionInput, isDemo = false): Promise<BankTransaction> {
    return this.db.transaction(async (tx) => {
      const moneyAccount = await this.moneyAccounts.requireActive(tx, orgId, input.moneyAccountId);
      const category = await this.requireCategory(tx, orgId, input.accountId);
      const contact = input.contactId ? await this.requireContact(tx, orgId, input.contactId) : null;

      const resolved = await this.taxResolver.resolve(orgId, { taxRateId: input.taxRateId, taxGroupId: input.taxGroupId }, tx);
      const taxAmount = resolved.rates.length ? computeLineTax(money(input.amount, "XXX"), resolved.rates, true).taxAmount.amount : 0n;
      const net = input.amount - taxAmount;

      const id = randomUUID();
      const tag = { contactId: contact?.id ?? null };
      const lines: PostingLine[] =
        input.direction === "in"
          ? [
              { accountId: moneyAccount.accountId, debit: input.amount, credit: 0n, ...tag },
              { accountId: category.id, debit: 0n, credit: input.amount, ...tag },
            ]
          : [
              { accountId: category.id, debit: net, credit: 0n, ...tag },
              ...(taxAmount > 0n ? [{ accountId: await this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable"), debit: taxAmount, credit: 0n, ...tag }] : []),
              { accountId: moneyAccount.accountId, debit: 0n, credit: input.amount, ...tag },
            ];
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: `${input.direction === "in" ? "Money in" : "Money out"} — ${category.name}`,
        sourceType: "bank_transaction",
        sourceId: id,
        lines,
        isDemo,
      });

      const [row] = await tx
        .insert(bankTransactions)
        .values({
          id,
          orgId,
          moneyAccountId: moneyAccount.id,
          direction: input.direction,
          accountId: category.id,
          contactId: contact?.id ?? null,
          amount: input.amount,
          taxRateId: input.taxRateId,
          taxGroupId: input.taxGroupId,
          taxAmount,
          date: input.date,
          description: input.description,
          entryId,
          createdByUserId: actorUserId,
          isDemo,
        })
        .returning();
      await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "money_in_out", moneyAccount.id);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "bank_transaction",
        entityId: id,
        contactId: contact?.id ?? null,
        changes: { direction: input.direction, account: `${category.code} · ${category.name}`, amount: input.amount.toString(), taxAmount: taxAmount.toString(), date: input.date },
      });
      return this.toResponse(row!, { id: moneyAccount.id, name: moneyAccount.name }, category, contact);
    });
  }

  /** US-BANK-14 — one entry, for the register's drawer: its category, tax, contact, who recorded it and whether it's reconciled. */
  async getOne(orgId: string, id: string): Promise<BankTransaction & BankEntryDetails> {
    const [row] = await this.db
      .select({ t: bankTransactions, money: moneyAccounts, account: accounts, contactName: contacts.name, rateName: taxRates.name, groupName: taxGroups.name, createdBy: user.name })
      .from(bankTransactions)
      .innerJoin(moneyAccounts, eq(moneyAccounts.id, bankTransactions.moneyAccountId))
      .innerJoin(accounts, eq(accounts.id, bankTransactions.accountId))
      .leftJoin(contacts, eq(contacts.id, bankTransactions.contactId))
      .leftJoin(taxRates, eq(taxRates.id, bankTransactions.taxRateId))
      .leftJoin(taxGroups, eq(taxGroups.id, bankTransactions.taxGroupId))
      .leftJoin(user, eq(user.id, bankTransactions.createdByUserId))
      .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.id, id)));
    if (!row) throw new NotFoundException("Entry not found");
    const [reconciled] = await this.db
      .select({ id: journalLines.id })
      .from(journalLines)
      .where(and(eq(journalLines.entryId, row.t.entryId), eq(journalLines.accountId, row.money.accountId), isNotNull(journalLines.reconciliationId)))
      .limit(1);
    return {
      ...this.toResponse(row.t, { id: row.money.id, name: row.money.name }, row.account, row.t.contactId && row.contactName ? { id: row.t.contactId, name: row.contactName } : null),
      reconciled: Boolean(reconciled),
      taxName: row.rateName ?? row.groupName ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.t.createdAt.toISOString(),
    };
  }

  async remove(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(bankTransactions)
        .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.id, id)))
        .for("update");
      if (!existing) throw new NotFoundException("Entry not found");
      if (existing.deletedAt) throw new BadRequestException("This entry has already been deleted.");
      const reversalEntryId = await this.ledger.reverseEntry(tx, existing.entryId, {
        orgId,
        date: orgClock().date,
        narration: `${existing.direction === "in" ? "Money in" : "Money out"} deleted`,
        sourceType: "bank_transaction_delete",
        sourceId: id,
      });
      await tx.update(bankTransactions).set({ deletedAt: new Date(), reversalEntryId, updatedAt: new Date() }).where(eq(bankTransactions.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "bank_transaction",
        entityId: id,
        contactId: existing.contactId,
        changes: { amount: existing.amount.toString() },
      });
    });
    return { id };
  }

  /** A category is any of the organisation's accounts except the control accounts and the money accounts themselves. */
  private async requireCategory(tx: Transaction, orgId: string, accountId: string) {
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId)));
    if (!account) throw new BadRequestException("Choose a category.");
    if (CONTROL_CODES.has(account.code)) throw new BadRequestException(CONTROL_ACCOUNT_HINT);
    const [isMoney] = await tx.select({ id: moneyAccounts.id }).from(moneyAccounts).where(eq(moneyAccounts.accountId, account.id));
    if (isMoney) throw new BadRequestException(MONEY_ACCOUNT_AS_CATEGORY);
    return account;
  }

  private async requireContact(tx: Transaction, orgId: string, contactId: string) {
    const [contact] = await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact) throw new BadRequestException("Contact not found");
    return contact;
  }

  private toResponse(
    row: typeof bankTransactions.$inferSelect,
    moneyAccount: { id: string; name: string },
    account: { id: string; code: string; name: string },
    contact: { id: string; name: string } | null,
  ): BankTransaction {
    return {
      id: row.id,
      moneyAccount,
      direction: row.direction,
      account: { id: account.id, code: account.code, name: account.name },
      contact,
      amount: row.amount.toString(),
      taxAmount: row.taxAmount.toString(),
      date: row.date,
      description: row.description,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }
}
