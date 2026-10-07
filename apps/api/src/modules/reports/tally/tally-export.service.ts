import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { gstState, minorUnitExponent } from "@spine/shared";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import {
  accounts,
  addresses,
  contacts,
  creditNotes,
  invoices,
  journalEntries,
  journalLines,
  paymentAllocations,
  vendorBills,
  vendorCredits,
  vendorPaymentAllocations,
} from "../../../db/schema";
import { AuditLogService } from "../../audit/audit-log.service";
import { SettingsService } from "../../org/settings.service";
import { LedgerSourcesService } from "../ledger-sources.service";
import { TallyMappingService } from "./tally-mapping.service";
import {
  mastersXml,
  readmeText,
  TALLY_VOUCHER_TYPES,
  vouchersXml,
  type TallyBill,
  type TallyEntry,
  type TallyLedger,
  type TallyParty,
  type TallyVoucher,
  type TallyVoucherType,
} from "./tally-xml";

export const TALLY_RANGE_MESSAGE = "Choose a From date on or before the To date.";

/** The Spine documents behind each voucher type, as the page lists them. */
export const VOUCHER_TYPE_LABELS: Record<TallyVoucherType, string> = {
  Sales: "Invoices",
  Purchase: "Vendor bills",
  Receipt: "Customer payments and other money in",
  Payment: "Vendor payments, refunds, expenses and other money out",
  Contra: "Transfers",
  Journal: "Journals, opening balances, voids and credit applied",
  "Credit Note": "Credit notes",
  "Debit Note": "Vendor credits",
};

/** Tally voucher type per ledger source; anything else is a Journal. */
const BY_SOURCE: Record<string, TallyVoucherType> = {
  invoice: "Sales",
  vendor_bill: "Purchase",
  payment: "Receipt",
  vendor_refund: "Receipt",
  tax_refund: "Receipt",
  vendor_payment: "Payment",
  customer_refund: "Payment",
  expense: "Payment",
  tax_payment: "Payment",
  bank_transfer: "Contra",
  credit_note: "Credit Note",
  vendor_credit: "Debit Note",
};
/** The groups Tally treats as cash or bank: Receipt, Payment and Contra need them. */
const CASH_GROUPS = ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"];
const AR_CODE = "1100";
const AP_CODE = "2000";

const isoDate = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * US-RPT-38 (D-149) — the books for a date range as Tally XML, read from
 * the ledger: one voucher per journal entry, every account used as a
 * ledger under its mapped group (US-RPT-39), and customers and vendors as
 * bill-wise party ledgers in place of Accounts Receivable and Payable.
 */
@Injectable()
export class TallyExportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly mapping: TallyMappingService,
    private readonly sources: LedgerSourcesService,
    private readonly settings: SettingsService,
    private readonly audit: AuditLogService,
  ) {}

  async build(orgId: string, from: string, to: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "") || from > to) throw new BadRequestException(TALLY_RANGE_MESSAGE);

    const rows = await this.db
      .select({ line: journalLines, entry: journalEntries, account: accounts })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), gte(journalEntries.date, from), lte(journalEntries.date, to)))
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt), asc(journalLines.id));

    const mapping = new Map((await this.mapping.rows(orgId)).map((r) => [r.accountId, r]));
    const isParty = (code: string, contactId: string | null) => Boolean(contactId) && (code === AR_CODE || code === AP_CODE);

    // Customers and vendors on Accounts Receivable and Payable lines become party ledgers.
    const partyIds = [...new Set(rows.filter((r) => isParty(r.account.code, r.line.contactId)).map((r) => r.line.contactId!))];
    const contactRows = partyIds.length ? await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.id, partyIds))) : [];
    const addressRows = partyIds.length ? await this.db.select().from(addresses).where(inArray(addresses.contactId, partyIds)) : [];

    // Ledger names are unique in Tally: accounts by name, then parties, suffixed when a name is taken.
    const ledgers = new Map<string, TallyLedger>();
    const accountLedger = new Map<string, string>();
    const usedAccounts = [...new Map(rows.filter((r) => !isParty(r.account.code, r.line.contactId)).map((r) => [r.account.id, r.account])).values()].sort((a, b) => a.code.localeCompare(b.code));
    const take = (wanted: string, suffix: string) => {
      let name = wanted;
      for (let n = 1; ledgers.has(name.toLowerCase()); n++) name = n === 1 ? `${wanted} (${suffix})` : `${wanted} (${suffix} ${n})`;
      return name;
    };
    for (const a of usedAccounts) {
      const name = take(a.name, a.code);
      ledgers.set(name.toLowerCase(), { name, parent: mapping.get(a.id)?.tallyGroup ?? "Suspense A/c" });
      accountLedger.set(a.id, name);
    }
    const partyLedger = new Map<string, string>();
    for (const side of ["debtor", "creditor"] as const) {
      const code = side === "debtor" ? AR_CODE : AP_CODE;
      const ids = [...new Set(rows.filter((r) => r.account.code === code && r.line.contactId && partyIds.includes(r.line.contactId)).map((r) => r.line.contactId!))];
      for (const id of ids) {
        const c = contactRows.find((x) => x.id === id);
        const name = take(c?.name ?? "Deleted contact", side === "debtor" ? "customer" : "vendor");
        const billing = addressRows.filter((a) => a.contactId === id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0];
        const party: TallyParty = {
          address: billing ? [billing.line1, billing.line2, [billing.city, billing.postalCode].filter(Boolean).join(" ")].filter((l): l is string => Boolean(l?.trim())) : [],
          state: gstState(billing?.stateCode)?.name ?? billing?.state ?? null,
          country: billing?.country ?? (billing?.stateCode ? "India" : null),
          gstin: c?.gstTreatment === "registered" || c?.gstTreatment === "sez" ? (c.taxId?.trim() ?? null) : null,
          registrationType: c?.gstTreatment === "registered" || c?.gstTreatment === "sez" ? "Regular" : c?.gstTreatment === "consumer" ? "Consumer" : c?.gstTreatment ? "Unregistered" : null,
        };
        ledgers.set(name.toLowerCase(), { name, parent: side === "debtor" ? "Sundry Debtors" : "Sundry Creditors", party });
        partyLedger.set(`${code}:${id}`, name);
      }
    }

    // Bill-wise references: what each document's party line settles.
    const entries = [...new Map(rows.map((r) => [r.entry.id, r.entry])).values()];
    const described = await this.sources.describe(
      orgId,
      entries.map((e) => ({ sourceType: e.sourceType, sourceId: e.sourceId })),
    );
    const idsOf = (...types: string[]) => [...new Set(entries.filter((e) => types.includes(e.sourceType)).map((e) => e.sourceId))];
    const invoiceNumbers = new Map<string, string>();
    const billNumbers = new Map<string, string>();
    const paymentAllocs = idsOf("payment").length
      ? await this.db
          .select({ paymentId: paymentAllocations.paymentId, amount: paymentAllocations.amount, number: invoices.number })
          .from(paymentAllocations)
          .innerJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
          .where(inArray(paymentAllocations.paymentId, idsOf("payment")))
      : [];
    const vendorAllocs = idsOf("vendor_payment").length
      ? await this.db
          .select({ paymentId: vendorPaymentAllocations.vendorPaymentId, amount: vendorPaymentAllocations.amount, number: vendorBills.billNumber })
          .from(vendorPaymentAllocations)
          .innerJoin(vendorBills, eq(vendorPaymentAllocations.billId, vendorBills.id))
          .where(inArray(vendorPaymentAllocations.vendorPaymentId, idsOf("vendor_payment")))
      : [];
    if (idsOf("credit_note").length) {
      for (const r of await this.db.select({ id: creditNotes.id, number: invoices.number }).from(creditNotes).innerJoin(invoices, eq(creditNotes.invoiceId, invoices.id)).where(inArray(creditNotes.id, idsOf("credit_note")))) {
        if (r.number) invoiceNumbers.set(`credit_note:${r.id}`, r.number);
      }
    }
    if (idsOf("vendor_credit").length) {
      for (const r of await this.db.select({ id: vendorCredits.id, number: vendorBills.billNumber }).from(vendorCredits).innerJoin(vendorBills, eq(vendorCredits.billId, vendorBills.id)).where(inArray(vendorCredits.id, idsOf("vendor_credit")))) {
        billNumbers.set(`vendor_credit:${r.id}`, r.number);
      }
    }

    const billsFor = (sourceType: string, sourceId: string, number: string | null, amount: bigint): TallyBill[] => {
      const one = (type: TallyBill["type"], name: string | null): TallyBill[] => [{ name: name ?? "On Account", type: name ? type : "On Account", amount }];
      switch (sourceType) {
        case "invoice":
        case "opening_invoice":
        case "vendor_bill":
        case "opening_bill":
          return one("New Ref", number);
        case "invoice_void":
        case "vendor_bill_void":
          return one("Agst Ref", number);
        case "credit_note":
          return one("Agst Ref", invoiceNumbers.get(`credit_note:${sourceId}`) ?? null);
        case "vendor_credit":
          return one("Agst Ref", billNumbers.get(`vendor_credit:${sourceId}`) ?? null);
        case "payment":
        case "vendor_payment": {
          // Settle the allocated invoices or bills, up to this line's amount; the rest is on account.
          const allocs = (sourceType === "payment" ? paymentAllocs : vendorAllocs).filter((a) => a.paymentId === sourceId && a.number);
          const sign = amount < 0n ? -1n : 1n;
          let left = amount * sign;
          const bills: TallyBill[] = [];
          for (const a of allocs) {
            if (left <= 0n) break;
            const part = a.amount < left ? a.amount : left;
            bills.push({ name: a.number!, type: "Agst Ref", amount: part * sign });
            left -= part;
          }
          if (left > 0n) bills.push({ name: "On Account", type: "On Account", amount: left * sign });
          return bills;
        }
        default:
          return one("On Account", null);
      }
    };

    const groupOf = (ledger: string) => ledgers.get(ledger.toLowerCase())?.parent ?? "";
    const vouchers: TallyVoucher[] = entries.map((entry) => {
      const lines = rows.filter((r) => r.entry.id === entry.id);
      const source = described.get(`${entry.sourceType}:${entry.sourceId}`);
      const number = source?.number ?? null;
      const tallyEntries: TallyEntry[] = lines.map((r) => {
        const amount = r.line.debit - r.line.credit;
        if (isParty(r.account.code, r.line.contactId)) {
          return { ledger: partyLedger.get(`${r.account.code}:${r.line.contactId}`)!, amount, bills: billsFor(entry.sourceType, entry.sourceId, number, amount) };
        }
        return { ledger: accountLedger.get(r.account.id)!, amount };
      });
      const cash = tallyEntries.filter((e) => CASH_GROUPS.includes(groupOf(e.ledger)));
      let type: TallyVoucherType = BY_SOURCE[entry.sourceType] ?? "Journal";
      if (entry.sourceType === "bank_transaction") type = cash.some((e) => e.amount > 0n) ? "Receipt" : "Payment";
      // Tally needs a cash or bank ledger in a Receipt or Payment, and only those in a Contra.
      if ((type === "Receipt" || type === "Payment") && cash.length === 0) type = "Journal";
      if (type === "Contra" && cash.length !== tallyEntries.length) type = "Journal";
      const party = tallyEntries.find((e) => e.bills)?.ledger ?? null;
      return {
        id: entry.id,
        type,
        date: isoDate(entry.date),
        number,
        narration: [entry.narration, source?.label].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(" — ") || "Spine journal entry",
        partyLedger: type === "Journal" || type === "Contra" ? null : party,
        entries: tallyEntries,
      };
    });

    const usedIds = new Set(usedAccounts.map((a) => a.id));
    const defaults = [...mapping.values()].filter((m) => usedIds.has(m.accountId) && m.isDefault).map((m) => ({ code: m.code, name: m.name, group: m.tallyGroup }));
    const counts = TALLY_VOUCHER_TYPES.map((type) => ({ type, count: vouchers.filter((v) => v.type === type).length }));
    return { from, to, ledgers: [...ledgers.values()], vouchers, counts, defaults };
  }

  /** What the page shows before exporting. */
  async summary(orgId: string, from: string, to: string) {
    const built = await this.build(orgId, from, to);
    return {
      from,
      to,
      ledgers: built.ledgers.length,
      vouchers: built.vouchers.length,
      byType: built.counts.map((c) => ({ voucherType: c.type, label: VOUCHER_TYPE_LABELS[c.type], count: c.count })),
      defaults: built.defaults,
    };
  }

  /** The ZIP: masters.xml, vouchers.xml and README.txt. Downloading it is audited. */
  async zip(orgId: string, actorUserId: string, from: string, to: string): Promise<{ filename: string; body: Buffer }> {
    const built = await this.build(orgId, from, to);
    const currency = (await this.settings.get<{ code?: string }>(orgId, "currency"))?.code ?? "USD";
    const business = (await this.settings.get<{ name?: string }>(orgId, "business_profile"))?.name?.trim() || "Your business";
    const files = {
      "masters.xml": strToU8(mastersXml(built.ledgers)),
      "vouchers.xml": strToU8(vouchersXml(built.vouchers, minorUnitExponent(currency))),
      "README.txt": strToU8(readmeText({ business, from, to, ledgers: built.ledgers.length, counts: built.counts, defaults: built.defaults })),
    };
    await this.audit.record(this.db, { orgId, actorUserId, action: "downloaded", entityType: "tally_export", entityId: orgId, contactId: null, changes: { from, to, vouchers: built.vouchers.length } });
    return { filename: `tally-${from}-${to}.zip`, body: Buffer.from(zipSync(files)) };
  }
}
