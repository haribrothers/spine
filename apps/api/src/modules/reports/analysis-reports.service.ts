import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  ITEMS_NOT_FROM_CATALOGUE,
  sharePercent,
  type AnalysisDocumentRef,
  type SalesByCustomerReport,
  type SalesByCustomerRow,
  type SalesByItemReport,
} from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, catalogItems, contacts, creditNoteLines, creditNotes, invoiceLines, invoices, journalEntries, journalLines } from "../../db/schema";
import { SYSTEM_ACCOUNT_CODES } from "../ledger/ledger.service";

const isoDay = (d: Date | string | null) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d ?? ""));

/** US-RPT-28, US-RPT-29 — sales and purchase analysis for a range. */
@Injectable()
export class AnalysisReportsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Each customer's income (net of credit notes) and output tax posted in
   * the range, from income and 2100 journal lines carrying the contact;
   * invoice count is the issued invoices behind that income. Largest first.
   */
  async salesByCustomer(orgId: string, from: string, to: string): Promise<SalesByCustomerReport> {
    const lines = await this.db
      .select({
        contactId: journalLines.contactId,
        name: contacts.name,
        type: accounts.type,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .innerJoin(contacts, eq(contacts.id, journalLines.contactId))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, from),
          lte(journalEntries.date, to),
          isNotNull(journalLines.contactId),
          or(eq(accounts.type, "income"), eq(accounts.code, SYSTEM_ACCOUNT_CODES.outputTaxPayable)),
        ),
      );

    const byContact = new Map<string, { name: string; sales: bigint; tax: bigint; invoiceIds: Set<string> }>();
    for (const l of lines) {
      const row = byContact.get(l.contactId!) ?? { name: l.name, sales: 0n, tax: 0n, invoiceIds: new Set<string>() };
      const net = l.credit - l.debit;
      if (l.type === "income") {
        row.sales += net;
        if (l.sourceType === "invoice") row.invoiceIds.add(l.sourceId);
      } else {
        row.tax += net;
      }
      byContact.set(l.contactId!, row);
    }

    const invoiceIds = [...byContact.values()].flatMap((r) => [...r.invoiceIds]);
    const issued = invoiceIds.length
      ? await this.db
          .select({ id: invoices.id, number: invoices.number, issueDate: invoices.issueDate, total: invoices.totalAmount })
          .from(invoices)
          .where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds), eq(invoices.status, "issued")))
      : [];
    const refOf = new Map<string, AnalysisDocumentRef>(issued.map((i) => [i.id, { id: i.id, number: i.number, date: isoDay(i.issueDate), total: i.total.toString(), href: `/invoices/${i.id}` }]));

    const totalSales = [...byContact.values()].reduce((s, r) => s + r.sales, 0n);
    const rows: SalesByCustomerRow[] = [...byContact.entries()]
      .filter(([, r]) => r.sales !== 0n || r.tax !== 0n)
      .map(([contactId, r]) => {
        const refs = [...r.invoiceIds].map((id) => refOf.get(id)).filter((x): x is AnalysisDocumentRef => !!x).sort((a, b) => a.date.localeCompare(b.date));
        return {
          contactId,
          name: r.name,
          invoiceCount: refs.length,
          salesBeforeTax: r.sales.toString(),
          tax: r.tax.toString(),
          total: (r.sales + r.tax).toString(),
          percentOfSales: sharePercent(r.sales, totalSales),
          invoices: refs,
        };
      })
      .sort((a, b) => (BigInt(b.salesBeforeTax) > BigInt(a.salesBeforeTax) ? 1 : BigInt(b.salesBeforeTax) < BigInt(a.salesBeforeTax) ? -1 : a.name.localeCompare(b.name)));

    const sum = (pick: (r: SalesByCustomerRow) => string) => rows.reduce((s, r) => s + BigInt(pick(r)), 0n).toString();
    return {
      from,
      to,
      rows,
      totals: { customers: rows.length, invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0), salesBeforeTax: sum((r) => r.salesBeforeTax), tax: sum((r) => r.tax), total: sum((r) => r.total) },
    };
  }

  /**
   * Quantity and sales before tax per catalogue item from the item lines of
   * standard and progress invoices issued in the range, less the item lines
   * of credit notes dated in the range (D-031 exception: the ledger has no
   * quantities). Lines typed by hand group as "Items not from the catalogue".
   */
  async salesByItem(orgId: string, from: string, to: string): Promise<SalesByItemReport> {
    const sold = await this.db
      .select({
        catalogItemId: invoiceLines.catalogItemId,
        itemName: catalogItems.name,
        quantity: invoiceLines.quantity,
        subtotal: invoiceLines.lineSubtotalAmount,
        invoiceId: invoices.id,
        number: invoices.number,
        issueDate: invoices.issueDate,
        total: invoices.totalAmount,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .leftJoin(catalogItems, eq(catalogItems.id, invoiceLines.catalogItemId))
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.status, "issued"),
          inArray(invoices.type, ["standard", "progress"]),
          eq(invoiceLines.type, "item"),
          sql`${invoices.issueDate} >= ${from}::date`,
          sql`${invoices.issueDate} <= ${to}::date`,
        ),
      );
    const credited = await this.db
      .select({ catalogItemId: creditNoteLines.catalogItemId, itemName: catalogItems.name, quantity: creditNoteLines.quantity, subtotal: creditNoteLines.lineSubtotalAmount })
      .from(creditNoteLines)
      .innerJoin(creditNotes, eq(creditNotes.id, creditNoteLines.creditNoteId))
      .leftJoin(catalogItems, eq(catalogItems.id, creditNoteLines.catalogItemId))
      .where(
        and(
          eq(creditNotes.orgId, orgId),
          eq(creditNotes.status, "issued"),
          eq(creditNoteLines.type, "item"),
          sql`${creditNotes.date} >= ${from}::date`,
          sql`${creditNotes.date} <= ${to}::date`,
        ),
      );

    const groups = new Map<string, { catalogItemId: string | null; name: string; quantity: number; sales: bigint; invoices: Map<string, AnalysisDocumentRef> }>();
    const group = (catalogItemId: string | null, itemName: string | null) => {
      const key = catalogItemId ?? "none";
      const g = groups.get(key) ?? { catalogItemId, name: catalogItemId ? (itemName ?? "Deleted item") : ITEMS_NOT_FROM_CATALOGUE, quantity: 0, sales: 0n, invoices: new Map() };
      groups.set(key, g);
      return g;
    };
    for (const l of sold) {
      const g = group(l.catalogItemId, l.itemName);
      g.quantity += Number(l.quantity);
      g.sales += l.subtotal;
      g.invoices.set(l.invoiceId, { id: l.invoiceId, number: l.number, date: isoDay(l.issueDate), total: l.total.toString(), href: `/invoices/${l.invoiceId}` });
    }
    for (const l of credited) {
      const g = group(l.catalogItemId, l.itemName);
      g.quantity -= Number(l.quantity);
      g.sales -= l.subtotal;
    }
    const rows = [...groups.values()]
      .filter((g) => g.sales !== 0n || g.quantity !== 0)
      .map((g) => {
        const quantity = Math.round(g.quantity * 10000) / 10000;
        return {
          catalogItemId: g.catalogItemId,
          name: g.name,
          quantity,
          salesBeforeTax: g.sales.toString(),
          averagePrice: quantity > 0 ? (BigInt(Math.round(Number(g.sales) / quantity))).toString() : null,
          invoices: [...g.invoices.values()].sort((a, b) => a.date.localeCompare(b.date)),
        };
      })
      .sort((a, b) => {
        // The catalogue's items by sales, largest first; hand-typed lines last.
        if ((a.catalogItemId === null) !== (b.catalogItemId === null)) return a.catalogItemId === null ? 1 : -1;
        const d = BigInt(b.salesBeforeTax) - BigInt(a.salesBeforeTax);
        return d > 0n ? 1 : d < 0n ? -1 : a.name.localeCompare(b.name);
      });
    return { from, to, rows, totals: { salesBeforeTax: rows.reduce((s, r) => s + BigInt(r.salesBeforeTax), 0n).toString() } };
  }
}
