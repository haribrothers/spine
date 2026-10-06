import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";

/**
 * US-SET-15 (D-094) — what a data export contains: every business table,
 * one file each, scoped to the organisation. A table without its own
 * `org_id` is reached through its parent (`via`). Tables that only hold
 * secrets or sign-in machinery are left out entirely, and any column whose
 * name says it's a secret is dropped from every table.
 */
export interface ExportTable {
  /** File name without extension: `contacts`, `invoice_lines`. */
  name: string;
  table: PgTable;
  /** What the README says the file holds. */
  description: string;
  /** For a child table: its column pointing at the parent, and the parent table (which has `org_id`). */
  via?: { column: string; parent: PgTable };
}

const t = (table: PgTable, description: string, via?: ExportTable["via"]): ExportTable => ({ name: getTableName(table as Table), table, description, via });

export const EXPORT_TABLES: ExportTable[] = [
  t(schema.contacts, "Customers and vendors."),
  t(schema.contactPersons, "People at each contact.", { column: "contactId", parent: schema.contacts }),
  t(schema.addresses, "Contact addresses.", { column: "contactId", parent: schema.contacts }),
  t(schema.leadStages, "Pipeline stages."),
  t(schema.leads, "Leads in the pipeline."),
  t(schema.activities, "Calls, tasks and notes on contacts and leads."),
  t(schema.meetings, "Meetings."),
  t(schema.meetingAttendees, "Who was invited to each meeting.", { column: "meetingId", parent: schema.meetings }),
  t(schema.meetingOccurrenceExceptions, "Changes to single occurrences of repeating meetings.", { column: "meetingId", parent: schema.meetings }),
  t(schema.catalogItems, "Products and services in the catalogue."),
  t(schema.catalogBundles, "Catalogue bundles."),
  t(schema.catalogBundleLines, "Items in each bundle.", { column: "bundleId", parent: schema.catalogBundles }),
  t(schema.quotes, "Quotes."),
  t(schema.quoteLines, "Quote lines.", { column: "quoteId", parent: schema.quotes }),
  t(schema.quoteEvents, "Quote views, acceptances and declines."),
  t(schema.jobs, "Jobs."),
  t(schema.milestones, "Job milestones."),
  t(schema.jobAssignments, "Who is on each job's crew."),
  t(schema.jobNotes, "Job notes."),
  t(schema.jobPhotos, "Job photos (the images are in files/ when included)."),
  t(schema.jobVariationOrders, "Variation orders."),
  t(schema.invoices, "Invoices."),
  t(schema.invoiceLines, "Invoice lines.", { column: "invoiceId", parent: schema.invoices }),
  t(schema.invoiceReminders, "Payment reminders sent for invoices."),
  t(schema.recurringInvoices, "Recurring invoice schedules."),
  t(schema.recurringInvoiceLines, "Recurring invoice lines.", { column: "recurringInvoiceId", parent: schema.recurringInvoices }),
  t(schema.recurringBills, "Recurring bill schedules."),
  t(schema.recurringBillLines, "Recurring bill lines.", { column: "recurringBillId", parent: schema.recurringBills }),
  t(schema.creditNotes, "Credit notes."),
  t(schema.creditNoteLines, "Credit note lines.", { column: "creditNoteId", parent: schema.creditNotes }),
  t(schema.payments, "Payments received."),
  t(schema.paymentAllocations, "How each payment was applied to invoices."),
  t(schema.vendorBills, "Vendor bills."),
  t(schema.vendorBillLines, "Vendor bill lines.", { column: "billId", parent: schema.vendorBills }),
  t(schema.vendorPayments, "Payments to vendors."),
  t(schema.vendorPaymentAllocations, "How each vendor payment was applied to bills."),
  t(schema.expenseCategories, "Expense categories."),
  t(schema.expenses, "Expenses."),
  t(schema.expenseLabourLines, "Labour lines on expenses."),
  t(schema.taxRates, "Tax rates."),
  t(schema.taxGroups, "Tax groups."),
  t(schema.taxGroupRates, "Rates in each tax group.", { column: "taxGroupId", parent: schema.taxGroups }),
  t(schema.accounts, "Chart of accounts."),
  t(schema.moneyAccounts, "Bank, cash and card accounts, each linked to its ledger account."),
  t(schema.bankTransfers, "Transfers between your own accounts."),
  t(schema.bankTransactions, "Money in and out with no invoice or bill."),
  t(schema.journalEntries, "Journal entries (the books)."),
  t(schema.journalLines, "Journal entry lines: account, debit, credit, contact and job.", { column: "entryId", parent: schema.journalEntries }),
  t(schema.fiscalPeriods, "Financial periods."),
  t(schema.numberSequences, "Document numbering."),
  t(schema.settings, "Organisation settings."),
  t(schema.teams, "Teams."),
  t(schema.teamPrivileges, "What each team may do.", { column: "teamId", parent: schema.teams }),
  t(schema.teamMemberships, "Who is in each team.", { column: "teamId", parent: schema.teams }),
  t(schema.files, "Stored files' names, types and sizes (the files themselves are in files/ when included)."),
  t(schema.attachments, "Which files are attached to which records, who added them and any removals."),
  t(schema.auditLog, "Every recorded change: who, what and when."),
];

/** Column names that carry secrets; never exported from any table. */
export const SECRET_COLUMN = /(token|secret|password|apikey|vapid|privatekey)/i;

/** Settings keys that carry secrets. */
export const SECRET_SETTING = /(token|secret|password|smtp|vapid|key$)/i;

/** The table's columns minus secrets, as `{ propertyName: column }`. */
export function exportColumns(table: PgTable) {
  return Object.fromEntries(Object.entries(getTableColumns(table)).filter(([name, col]) => !SECRET_COLUMN.test(name) && !SECRET_COLUMN.test(col.name)));
}
