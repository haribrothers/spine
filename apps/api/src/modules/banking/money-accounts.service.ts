import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  DUPLICATE_MONEY_ACCOUNT_NAME,
  MONEY_ACCOUNT_CODE_RANGES,
  MONEY_ACCOUNT_KINDS,
  type MoneyAccount,
  type MoneyAccountInput,
  type MoneyAccountKind,
  type MoneyAccountNextCodes,
} from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, journalLines, moneyAccounts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

type MoneyAccountRow = typeof moneyAccounts.$inferSelect;

/**
 * US-BANK-01 (D-140) — bank, cash and card accounts. Each one owns one
 * ledger account, created here with the next free code in its kind's range;
 * its balance is always read from that account's journal lines (D-011),
 * never stored.
 */
@Injectable()
export class MoneyAccountsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, opts: { includeArchived: boolean; withBalances: boolean }): Promise<MoneyAccount[]> {
    const rows = await this.db
      .select({ money: moneyAccounts, code: accounts.code })
      .from(moneyAccounts)
      .innerJoin(accounts, eq(accounts.id, moneyAccounts.accountId))
      .where(and(eq(moneyAccounts.orgId, orgId), opts.includeArchived ? undefined : isNull(moneyAccounts.archivedAt)))
      .orderBy(asc(accounts.code));
    if (!opts.withBalances) return rows.map(({ money, code }) => this.toResponse(money, code));
    const [balances, unreconciled] = await Promise.all([this.balances(this.db, rows.map((r) => r.money)), this.unreconciledCounts(rows.map((r) => r.money))]);
    return rows.map(({ money, code }) => ({
      ...this.toResponse(money, code),
      balance: (balances.get(money.id) ?? 0n).toString(),
      // Reconciliation arrives with US-BANK-08–US-BANK-10; until then every entry is unreconciled.
      lastReconciledOn: null,
      unreconciledCount: unreconciled.get(money.id) ?? 0,
    }));
  }

  async get(orgId: string, id: string): Promise<MoneyAccount & { balance: string }> {
    const [row] = await this.db
      .select({ money: moneyAccounts, code: accounts.code })
      .from(moneyAccounts)
      .innerJoin(accounts, eq(accounts.id, moneyAccounts.accountId))
      .where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.id, id)));
    if (!row) throw new NotFoundException("Money account not found");
    const balances = await this.balances(this.db, [row.money]);
    return { ...this.toResponse(row.money, row.code), balance: (balances.get(row.money.id) ?? 0n).toString() };
  }

  /** The ledger code a new account of each kind would get, for the dialog's hint. */
  async nextCodes(orgId: string): Promise<MoneyAccountNextCodes> {
    const used = await this.usedCodes(this.db, orgId);
    return Object.fromEntries(MONEY_ACCOUNT_KINDS.map((kind) => [kind, this.nextFreeCode(used, kind)])) as MoneyAccountNextCodes;
  }

  async create(orgId: string, actorUserId: string, input: MoneyAccountInput): Promise<MoneyAccount> {
    return this.db.transaction(async (tx) => {
      // One account creation at a time per organisation, so two can't take the same code.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`money_accounts:${orgId}`}))`);
      await this.assertNameFree(tx, orgId, input.name, null);
      const code = this.nextFreeCode(await this.usedCodes(tx, orgId), input.kind);
      if (!code) {
        throw new BadRequestException(
          input.kind === "card"
            ? "There's no free ledger code left for cards (2300–2399). Archive a card you no longer use."
            : "There's no free ledger code left for bank and cash accounts (1011–1099). Archive an account you no longer use.",
        );
      }
      const [ledger] = await tx
        .insert(accounts)
        .values({ orgId, code, name: input.name, type: MONEY_ACCOUNT_CODE_RANGES[input.kind].type, isSystem: false })
        .returning();
      if (input.isDefault) await this.clearDefault(tx, orgId);
      const [money] = await tx
        .insert(moneyAccounts)
        .values({ orgId, accountId: ledger!.id, kind: input.kind, name: input.name, bankName: this.bankField(input.kind, input.bankName), last4: this.bankField(input.kind, input.last4), isDefault: input.isDefault })
        .returning();
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "create",
        entityType: "money_account",
        entityId: money!.id,
        contactId: null,
        changes: { name: input.name, kind: input.kind, code, isDefault: input.isDefault },
      });
      return { ...this.toResponse(money!, code), balance: "0" };
    });
  }

  async update(orgId: string, id: string, actorUserId: string, input: MoneyAccountInput): Promise<MoneyAccount> {
    return this.db.transaction(async (tx) => {
      const existing = await this.load(tx, orgId, id);
      if (existing.kind !== input.kind) throw new BadRequestException("An account's type can't change once it's added. Add a new account instead.");
      if (existing.isDefault && !input.isDefault) throw new BadRequestException("Choose another default account first.");
      if (input.isDefault && existing.archivedAt) throw new BadRequestException("Restore this account before making it the default.");
      await this.assertNameFree(tx, orgId, input.name, id);
      const next = {
        name: input.name,
        bankName: this.bankField(input.kind, input.bankName),
        last4: this.bankField(input.kind, input.last4),
        isDefault: input.isDefault,
      };
      if (input.isDefault && !existing.isDefault) await this.clearDefault(tx, orgId);
      const [money] = await tx
        .update(moneyAccounts)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(moneyAccounts.id, id))
        .returning();
      // The ledger account carries the same name, so reports read the same as Banking.
      await tx.update(accounts).set({ name: input.name, updatedAt: new Date() }).where(eq(accounts.id, existing.accountId));
      const changes = AuditLogService.diffFields(existing, next);
      if (changes.length) {
        await this.auditLog.record(tx, { orgId, actorUserId, action: "update", entityType: "money_account", entityId: id, contactId: null, changes });
      }
      const [ledger] = await tx.select({ code: accounts.code }).from(accounts).where(eq(accounts.id, existing.accountId));
      return this.toResponse(money!, ledger!.code);
    });
  }

  /**
   * The active money account a payment, expense or transfer posts to.
   * An archived account, or one from another organisation, is refused.
   */
  async requireActive(db: Database | Transaction, orgId: string, id: string): Promise<MoneyAccountRow> {
    const [row] = await db
      .select()
      .from(moneyAccounts)
      .where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.id, id), isNull(moneyAccounts.archivedAt)));
    if (!row) throw new BadRequestException("Choose one of your active accounts.");
    return row;
  }

  /** Each money account's balance in its own sign: an asset's debit balance, a card's credit balance (what's owed). */
  async balances(db: Database | Transaction, rows: Pick<MoneyAccountRow, "id" | "accountId" | "kind">[]): Promise<Map<string, bigint>> {
    if (!rows.length) return new Map();
    const sums = await db
      .select({
        accountId: journalLines.accountId,
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .where(inArray(journalLines.accountId, rows.map((r) => r.accountId)))
      .groupBy(journalLines.accountId);
    const byAccount = new Map(sums.map((s) => [s.accountId, BigInt(s.debit) - BigInt(s.credit)]));
    return new Map(rows.map((r) => {
      const net = byAccount.get(r.accountId) ?? 0n;
      return [r.id, r.kind === "card" ? -net : net];
    }));
  }

  /** How many journal lines on each account aren't reconciled yet. */
  private async unreconciledCounts(rows: Pick<MoneyAccountRow, "id" | "accountId">[]): Promise<Map<string, number>> {
    if (!rows.length) return new Map();
    const counts = await this.db
      .select({ accountId: journalLines.accountId, count: sql<number>`count(*)::int` })
      .from(journalLines)
      .where(inArray(journalLines.accountId, rows.map((r) => r.accountId)))
      .groupBy(journalLines.accountId);
    const byAccount = new Map(counts.map((c) => [c.accountId, c.count]));
    return new Map(rows.map((r) => [r.id, byAccount.get(r.accountId) ?? 0]));
  }

  private async load(db: Database | Transaction, orgId: string, id: string): Promise<MoneyAccountRow> {
    const [row] = await db.select().from(moneyAccounts).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.id, id)));
    if (!row) throw new NotFoundException("Money account not found");
    return row;
  }

  private async assertNameFree(db: Database | Transaction, orgId: string, name: string, exceptId: string | null) {
    const [clash] = await db
      .select({ id: moneyAccounts.id })
      .from(moneyAccounts)
      .where(and(eq(moneyAccounts.orgId, orgId), isNull(moneyAccounts.archivedAt), sql`lower(${moneyAccounts.name}) = lower(${name})`));
    if (clash && clash.id !== exceptId) throw new BadRequestException(DUPLICATE_MONEY_ACCOUNT_NAME(name));
  }

  private async clearDefault(tx: Transaction, orgId: string) {
    await tx.update(moneyAccounts).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.isDefault, true)));
  }

  private async usedCodes(db: Database | Transaction, orgId: string): Promise<Set<string>> {
    const rows = await db.select({ code: accounts.code }).from(accounts).where(eq(accounts.orgId, orgId));
    return new Set(rows.map((r) => r.code));
  }

  private nextFreeCode(used: Set<string>, kind: MoneyAccountKind): string | null {
    const range = MONEY_ACCOUNT_CODE_RANGES[kind];
    for (let code = range.from; code <= range.to; code++) {
      if (!used.has(String(code))) return String(code);
    }
    return null;
  }

  /** Cash has no bank or card number. */
  private bankField(kind: MoneyAccountKind, value: string | null): string | null {
    return kind === "cash" ? null : value;
  }

  private toResponse(row: MoneyAccountRow, code: string): MoneyAccount {
    return {
      id: row.id,
      accountId: row.accountId,
      code,
      kind: row.kind,
      name: row.name,
      bankName: row.bankName,
      last4: row.last4,
      isDefault: row.isDefault,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    };
  }
}
