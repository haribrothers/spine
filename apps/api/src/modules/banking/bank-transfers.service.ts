import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BankEntryDetails, BankTransfer, CreateBankTransferInput } from "@spine/shared";
import { orgClock } from "../../common/org-clock";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { bankTransfers, journalLines, moneyAccounts, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { MoneyAccountsService } from "./money-accounts.service";

/**
 * US-BANK-04 — a transfer between two of the organisation's own money
 * accounts. Posts P22 (Dr the destination's ledger account, Cr the
 * source's) in the same transaction as the row; deleting it posts the
 * reversing entry, dated today, and keeps the row as history.
 */
@Injectable()
export class BankTransfersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly ledger: LedgerService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** `isDemo` (US-ONB-34): loaded by the demo — the row and its entry are demo data. */
  async create(orgId: string, actorUserId: string, input: CreateBankTransferInput, isDemo = false): Promise<BankTransfer> {
    return this.db.transaction(async (tx) => {
      const from = await this.moneyAccounts.requireActive(tx, orgId, input.fromMoneyAccountId);
      const to = await this.moneyAccounts.requireActive(tx, orgId, input.toMoneyAccountId);
      const id = randomUUID();
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: `Transfer from ${from.name} to ${to.name}`,
        sourceType: "bank_transfer",
        sourceId: id,
        lines: [
          { accountId: to.accountId, debit: input.amount, credit: 0n },
          { accountId: from.accountId, debit: 0n, credit: input.amount },
        ],
        isDemo,
      });
      const [row] = await tx
        .insert(bankTransfers)
        .values({ id, orgId, fromMoneyAccountId: from.id, toMoneyAccountId: to.id, amount: input.amount, date: input.date, reference: input.reference, entryId, createdByUserId: actorUserId, isDemo })
        .returning();
      await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "money_in_out", from.id);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "bank_transfer",
        entityId: id,
        contactId: null,
        changes: { from: from.name, to: to.name, amount: input.amount.toString(), date: input.date },
      });
      return this.toResponse(row!, { id: from.id, name: from.name }, { id: to.id, name: to.name });
    });
  }

  /** US-BANK-14 — one transfer, for the register's drawer; reconciled when either side is. */
  async getOne(orgId: string, id: string): Promise<BankTransfer & BankEntryDetails> {
    const from = alias(moneyAccounts, "from_account");
    const to = alias(moneyAccounts, "to_account");
    const [row] = await this.db
      .select({ t: bankTransfers, from, to, createdBy: user.name })
      .from(bankTransfers)
      .innerJoin(from, eq(from.id, bankTransfers.fromMoneyAccountId))
      .innerJoin(to, eq(to.id, bankTransfers.toMoneyAccountId))
      .leftJoin(user, eq(user.id, bankTransfers.createdByUserId))
      .where(and(eq(bankTransfers.orgId, orgId), eq(bankTransfers.id, id)));
    if (!row) throw new NotFoundException("Transfer not found");
    const [reconciled] = await this.db
      .select({ id: journalLines.id })
      .from(journalLines)
      .where(and(eq(journalLines.entryId, row.t.entryId), inArray(journalLines.accountId, [row.from.accountId, row.to.accountId]), isNotNull(journalLines.reconciliationId)))
      .limit(1);
    return {
      ...this.toResponse(row.t, { id: row.from.id, name: row.from.name }, { id: row.to.id, name: row.to.name }),
      reconciled: Boolean(reconciled),
      taxName: null,
      createdBy: row.createdBy ?? null,
      createdAt: row.t.createdAt.toISOString(),
    };
  }

  async remove(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(bankTransfers)
        .where(and(eq(bankTransfers.orgId, orgId), eq(bankTransfers.id, id)))
        .for("update");
      if (!existing) throw new NotFoundException("Transfer not found");
      if (existing.deletedAt) throw new BadRequestException("This transfer has already been deleted.");
      const reversalEntryId = await this.ledger.reverseEntry(tx, existing.entryId, {
        orgId,
        date: orgClock().date,
        narration: "Transfer deleted",
        sourceType: "bank_transfer_delete",
        sourceId: id,
      });
      await tx.update(bankTransfers).set({ deletedAt: new Date(), reversalEntryId, updatedAt: new Date() }).where(eq(bankTransfers.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "bank_transfer", entityId: id, contactId: null, changes: { amount: existing.amount.toString() } });
    });
    return { id };
  }

  private toResponse(row: typeof bankTransfers.$inferSelect, from: { id: string; name: string }, to: { id: string; name: string }): BankTransfer {
    return {
      id: row.id,
      fromMoneyAccount: from,
      toMoneyAccount: to,
      amount: row.amount.toString(),
      date: row.date,
      reference: row.reference,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }
}
