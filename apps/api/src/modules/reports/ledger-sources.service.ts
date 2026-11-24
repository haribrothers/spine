import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import type { LedgerSource } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import {
  bankTransactions,
  creditNotes,
  customerRefunds,
  expenses,
  invoices,
  manualJournals,
  payments,
  taxPayments,
  vendorBills,
  vendorCredits,
  vendorPayments,
  vendorRefunds,
} from "../../db/schema";

type Ref = { sourceType: string; sourceId: string };
type Found = { number: string | null; href: string | null; extra?: string };

/** What each source type is called, with a suffix for reversals ("Invoice voided"). Unknown types read "Journal entry". */
const NAMES: Record<string, string> = {
  invoice: "Invoice",
  invoice_void: "Invoice voided",
  opening_invoice: "Opening invoice",
  opening_invoice_repost: "Opening invoice re-entered",
  credit_note: "Credit note",
  credit_note_credit_applied: "Credit applied from credit note",
  payment: "Payment",
  payment_delete: "Payment deleted",
  payment_credit_applied: "Credit applied from payment",
  opening_customer_credit: "Opening customer credit",
  opening_customer_credit_repost: "Opening customer credit re-entered",
  customer_refund: "Refund",
  customer_refund_delete: "Refund deleted",
  vendor_bill: "Bill",
  vendor_bill_void: "Bill voided",
  opening_bill: "Opening bill",
  opening_bill_repost: "Opening bill re-entered",
  vendor_credit: "Vendor credit",
  vendor_credit_void: "Vendor credit voided",
  opening_vendor_credit: "Opening vendor credit",
  opening_vendor_credit_repost: "Opening vendor credit re-entered",
  vendor_refund: "Vendor refund",
  vendor_refund_delete: "Vendor refund deleted",
  vendor_payment: "Vendor payment",
  vendor_payment_delete: "Vendor payment deleted",
  expense: "Expense",
  bank_transfer: "Transfer",
  bank_transfer_delete: "Transfer deleted",
  bank_transaction: "Money in or out",
  bank_transaction_delete: "Money in or out deleted",
  tax_payment: "Tax payment",
  tax_refund: "Tax refund",
  tax_payment_delete: "Tax payment deleted",
  manual_journal: "Journal",
  manual_journal_reversal: "Journal reversed",
  opening_balance: "Opening balances",
  opening_balance_repost: "Opening balances re-entered",
};

/**
 * US-RPT-24, US-RPT-25 — names any journal entry's source the way people
 * say it ("Invoice INV-0042", "Payment RCP-0012", "Journal JNL-0003") and
 * where its document opens, reading each document's own table once.
 */
@Injectable()
export class LedgerSourcesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async describe(orgId: string, refs: Ref[]): Promise<Map<string, LedgerSource>> {
    const ids = (...types: string[]) => [...new Set(refs.filter((r) => types.includes(r.sourceType)).map((r) => r.sourceId))];
    const found = new Map<string, Found>();
    const put = (types: string[], id: string, value: Found) => {
      for (const t of types) found.set(`${t}:${id}`, value);
    };

    const invoiceTypes = ["invoice", "invoice_void", "opening_invoice", "opening_invoice_repost"];
    const invoiceIds = ids(...invoiceTypes);
    if (invoiceIds.length) {
      for (const r of await this.db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds)))) put(invoiceTypes, r.id, { number: r.number, href: `/invoices/${r.id}` });
    }
    const creditTypes = ["credit_note", "credit_note_credit_applied"];
    const creditIds = ids(...creditTypes);
    if (creditIds.length) {
      for (const r of await this.db.select({ id: creditNotes.id, number: creditNotes.number, invoiceId: creditNotes.invoiceId }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.id, creditIds))))
        put(creditTypes, r.id, { number: r.number, href: `/invoices/${r.invoiceId}` });
    }
    const paymentTypes = ["payment", "payment_delete", "payment_credit_applied", "opening_customer_credit", "opening_customer_credit_repost"];
    const paymentIds = ids(...paymentTypes);
    if (paymentIds.length) {
      for (const r of await this.db.select({ id: payments.id, number: payments.number }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.id, paymentIds)))) put(paymentTypes, r.id, { number: r.number, href: `/payments?id=${r.id}` });
    }
    const refundTypes = ["customer_refund", "customer_refund_delete"];
    const refundIds = ids(...refundTypes);
    if (refundIds.length) {
      for (const r of await this.db.select({ id: customerRefunds.id, paymentId: customerRefunds.sourcePaymentId }).from(customerRefunds).where(and(eq(customerRefunds.orgId, orgId), inArray(customerRefunds.id, refundIds))))
        put(refundTypes, r.id, { number: null, href: r.paymentId ? `/payments?id=${r.paymentId}` : null });
    }
    const billTypes = ["vendor_bill", "vendor_bill_void", "opening_bill", "opening_bill_repost"];
    const billIds = ids(...billTypes);
    if (billIds.length) {
      for (const r of await this.db.select({ id: vendorBills.id, number: vendorBills.billNumber }).from(vendorBills).where(and(eq(vendorBills.orgId, orgId), inArray(vendorBills.id, billIds)))) put(billTypes, r.id, { number: r.number, href: `/vendor-bills/${r.id}` });
    }
    const vendorCreditTypes = ["vendor_credit", "vendor_credit_void", "opening_vendor_credit", "opening_vendor_credit_repost"];
    const vendorCreditIds = ids(...vendorCreditTypes);
    if (vendorCreditIds.length) {
      for (const r of await this.db.select({ id: vendorCredits.id, number: vendorCredits.number }).from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), inArray(vendorCredits.id, vendorCreditIds))))
        put(vendorCreditTypes, r.id, { number: r.number, href: `/vendor-credits/${r.id}` });
    }
    const vendorRefundTypes = ["vendor_refund", "vendor_refund_delete"];
    const vendorRefundIds = ids(...vendorRefundTypes);
    if (vendorRefundIds.length) {
      for (const r of await this.db.select({ id: vendorRefunds.id, creditId: vendorRefunds.vendorCreditId }).from(vendorRefunds).where(and(eq(vendorRefunds.orgId, orgId), inArray(vendorRefunds.id, vendorRefundIds))))
        put(vendorRefundTypes, r.id, { number: null, href: `/vendor-credits/${r.creditId}` });
    }
    const vendorPaymentTypes = ["vendor_payment", "vendor_payment_delete"];
    const vendorPaymentIds = ids(...vendorPaymentTypes);
    if (vendorPaymentIds.length) {
      for (const r of await this.db.select({ id: vendorPayments.id, number: vendorPayments.number }).from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), inArray(vendorPayments.id, vendorPaymentIds))))
        put(vendorPaymentTypes, r.id, { number: r.number, href: `/vendor-payments/${r.id}` });
    }
    const expenseIds = ids("expense");
    if (expenseIds.length) {
      for (const r of await this.db.select({ id: expenses.id, number: expenses.number }).from(expenses).where(and(eq(expenses.orgId, orgId), inArray(expenses.id, expenseIds)))) put(["expense"], r.id, { number: r.number, href: `/expenses?id=${r.id}` });
    }
    const transactionTypes = ["bank_transaction", "bank_transaction_delete"];
    const transactionIds = ids(...transactionTypes);
    if (transactionIds.length) {
      for (const r of await this.db.select({ id: bankTransactions.id, direction: bankTransactions.direction, moneyAccountId: bankTransactions.moneyAccountId }).from(bankTransactions).where(and(eq(bankTransactions.orgId, orgId), inArray(bankTransactions.id, transactionIds)))) {
        found.set(`bank_transaction:${r.id}`, { number: null, href: `/banking/${r.moneyAccountId}`, extra: r.direction === "in" ? "Money in" : "Money out" });
        found.set(`bank_transaction_delete:${r.id}`, { number: null, href: `/banking/${r.moneyAccountId}`, extra: r.direction === "in" ? "Money in deleted" : "Money out deleted" });
      }
    }
    const taxTypes = ["tax_payment", "tax_refund", "tax_payment_delete"];
    const taxIds = ids(...taxTypes);
    if (taxIds.length) {
      for (const r of await this.db.select({ id: taxPayments.id }).from(taxPayments).where(and(eq(taxPayments.orgId, orgId), inArray(taxPayments.id, taxIds)))) put(taxTypes, r.id, { number: null, href: "/reports/tax-summary" });
    }
    const journalTypes = ["manual_journal", "manual_journal_reversal"];
    const journalIds = ids(...journalTypes);
    if (journalIds.length) {
      for (const r of await this.db.select({ id: manualJournals.id, number: manualJournals.number }).from(manualJournals).where(and(eq(manualJournals.orgId, orgId), inArray(manualJournals.id, journalIds)))) put(journalTypes, r.id, { number: r.number, href: `/journals/${r.id}` });
    }

    const out = new Map<string, LedgerSource>();
    for (const ref of refs) {
      const key = `${ref.sourceType}:${ref.sourceId}`;
      if (out.has(key)) continue;
      const f = found.get(key);
      const isOpeningBalance = ref.sourceType.startsWith("opening_balance");
      const name = f?.extra ?? NAMES[ref.sourceType] ?? "Journal entry";
      out.set(key, {
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        label: f?.number ? `${name} ${f.number}` : name,
        href: isOpeningBalance ? "/opening-balances" : (f?.href ?? null),
        number: f?.number ?? null,
      });
    }
    return out;
  }
}
