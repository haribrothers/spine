import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { AccountRegister, AccountRegisterQuery, AccountRegisterRow } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, expenses, journalEntries, journalLines, payments, vendorPayments } from "../../db/schema";
import { MoneyAccountsService } from "./money-accounts.service";

/** What each kind of entry is called in a register. Unknown kinds read "Journal entry". */
const SOURCE_LABELS: Record<string, string> = {
  payment: "Payment",
  payment_delete: "Payment deleted",
  vendor_payment: "Vendor payment",
  vendor_payment_delete: "Vendor payment deleted",
  expense: "Expense",
};

interface SourceDetails {
  number: string | null;
  reference: string | null;
}

/**
 * US-BANK-02 — one money account's register: every journal line on its
 * ledger account (D-011), with a running balance that starts from the true
 * balance before the range, so filters never change the figures.
 */
@Injectable()
export class AccountRegisterService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
  ) {}

  async register(orgId: string, moneyAccountId: string, query: AccountRegisterQuery): Promise<AccountRegister> {
    const account = await this.moneyAccounts.get(orgId, moneyAccountId);
    const isCard = account.kind === "card";
    // A card's balance is what's owed: credits (spending) raise it.
    const signed = (debit: bigint, credit: bigint) => (isCard ? credit - debit : debit - credit);

    const onAccount = and(eq(journalEntries.orgId, orgId), eq(journalLines.accountId, account.accountId));
    let opening = 0n;
    if (query.from) {
      const [before] = await this.db
        .select({ debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`, credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(onAccount, lt(journalEntries.date, query.from)));
      opening = signed(BigInt(before!.debit), BigInt(before!.credit));
    }

    const lines = await this.db
      .select({ line: journalLines, entry: journalEntries })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(onAccount, query.from ? gte(journalEntries.date, query.from) : undefined, query.to ? lte(journalEntries.date, query.to) : undefined))
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt), asc(journalLines.id));

    const [details, entryContacts] = await Promise.all([this.sourceDetails(orgId, lines.map((l) => l.entry)), this.entryContacts(lines.map((l) => l.line))]);

    let balance = opening;
    let totalIn = 0n;
    let totalOut = 0n;
    const rows: AccountRegisterRow[] = lines.map(({ line, entry }) => {
      // Money in to a bank account is a debit; on a card a debit is paying it off.
      const moneyIn = line.debit;
      const moneyOut = line.credit;
      balance += signed(line.debit, line.credit);
      totalIn += moneyIn;
      totalOut += moneyOut;
      const source = details.get(`${entry.sourceType}:${entry.sourceId}`) ?? { number: null, reference: null };
      const label = SOURCE_LABELS[entry.sourceType] ?? "Journal entry";
      return {
        journalLineId: line.id,
        date: entry.date,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        what: source.number ? `${label} ${source.number}` : label,
        number: source.number,
        contact: entryContacts.get(line.id) ?? null,
        reference: source.reference,
        in: moneyIn.toString(),
        out: moneyOut.toString(),
        balance: balance.toString(),
        // Reconciliation arrives with US-BANK-08–US-BANK-10; until then nothing is reconciled.
        reconciled: false,
      };
    });

    const [anyEntry] = await this.db
      .select({ id: journalLines.id })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(onAccount)
      .limit(1);

    return {
      account,
      from: query.from ?? null,
      to: query.to ?? null,
      openingBalance: opening.toString(),
      rows: query.unreconciled ? rows.filter((r) => !r.reconciled) : rows,
      closingBalance: balance.toString(),
      totalIn: totalIn.toString(),
      totalOut: totalOut.toString(),
      hasEntries: Boolean(anyEntry),
    };
  }

  /** The number and reference of each source document, read from its own table. */
  private async sourceDetails(orgId: string, entries: { sourceType: string; sourceId: string }[]): Promise<Map<string, SourceDetails>> {
    const ids = (types: string[]) => [...new Set(entries.filter((e) => types.includes(e.sourceType)).map((e) => e.sourceId))];
    const out = new Map<string, SourceDetails>();
    const put = (types: string[], rows: { id: string; number: string | null; reference: string | null }[]) => {
      for (const row of rows) for (const type of types) out.set(`${type}:${row.id}`, { number: row.number, reference: row.reference });
    };

    const paymentTypes = ["payment", "payment_delete"];
    const paymentIds = ids(paymentTypes);
    if (paymentIds.length) {
      put(
        paymentTypes,
        await this.db.select({ id: payments.id, number: payments.number, reference: payments.reference }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.id, paymentIds))),
      );
    }
    const vendorTypes = ["vendor_payment", "vendor_payment_delete"];
    const vendorIds = ids(vendorTypes);
    if (vendorIds.length) {
      put(
        vendorTypes,
        await this.db
          .select({ id: vendorPayments.id, number: vendorPayments.number, reference: vendorPayments.reference })
          .from(vendorPayments)
          .where(and(eq(vendorPayments.orgId, orgId), inArray(vendorPayments.id, vendorIds))),
      );
    }
    const expenseIds = ids(["expense"]);
    if (expenseIds.length) {
      put(
        ["expense"],
        await this.db
          .select({ id: expenses.id, number: expenses.number, reference: expenses.description })
          .from(expenses)
          .where(and(eq(expenses.orgId, orgId), inArray(expenses.id, expenseIds))),
      );
    }
    return out;
  }

  /** The contact on each line: its own tag, else the first contact tagged anywhere in its entry. */
  private async entryContacts(lines: (typeof journalLines.$inferSelect)[]): Promise<Map<string, { id: string; name: string }>> {
    if (!lines.length) return new Map();
    const tagged = await this.db
      .select({ entryId: journalLines.entryId, contactId: journalLines.contactId, name: contacts.name })
      .from(journalLines)
      .innerJoin(contacts, eq(contacts.id, journalLines.contactId))
      .where(and(inArray(journalLines.entryId, [...new Set(lines.map((l) => l.entryId))]), isNotNull(journalLines.contactId)));
    const names = new Map(tagged.map((t) => [t.contactId!, t.name]));
    const byEntry = new Map<string, { id: string; name: string }>();
    for (const t of tagged) if (!byEntry.has(t.entryId)) byEntry.set(t.entryId, { id: t.contactId!, name: t.name });
    return new Map(
      lines.flatMap((l) => {
        const contact = l.contactId && names.has(l.contactId) ? { id: l.contactId, name: names.get(l.contactId)! } : byEntry.get(l.entryId);
        return contact ? [[l.id, contact] as const] : [];
      }),
    );
  }
}
