import { z } from "zod";
import type { Capability } from "./permissions.ts";

/**
 * US-RPT-23 — every report, grouped as the Reports page shows them, with
 * who can open each. Owners open everything; Field never; Staff need one of
 * `anyOf`. A report joins this list when its story ships.
 *
 * The financial statements a Team opens with "View financial statements"
 * (US-RPT-36, D-136) say so on their no-access page.
 */

export const REPORT_GROUPS = ["Business overview", "Sales", "Receivables", "Purchases", "Tax", "Jobs", "Accountant"] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export interface ReportEntry {
  slug: string;
  label: string;
  group: ReportGroup;
  href: string;
  /** "owner" for a report no Team right opens; otherwise any one of these capabilities. */
  access: "owner" | Capability[];
  /** Extra words the search matches. */
  keywords?: string;
  /** Only for businesses taxed in this country (US-TAX-16: GSTR-1 is India's). */
  country?: string;
}

export const REPORTS: ReportEntry[] = [
  { slug: "profit-and-loss", label: "Profit & Loss", group: "Business overview", href: "/reports/profit-and-loss", access: ["reports.view_financial_statements"], keywords: "income statement p&l pl" },
  { slug: "balance-sheet", label: "Balance Sheet", group: "Business overview", href: "/reports/balance-sheet", access: ["reports.view_financial_statements"], keywords: "assets liabilities equity" },
  { slug: "trial-balance", label: "Trial Balance", group: "Business overview", href: "/reports/trial-balance", access: ["reports.view_financial_statements"], keywords: "tb debits credits ledger" },
  { slug: "cash-flow", label: "Cash Flow", group: "Business overview", href: "/reports/cash-flow", access: ["reports.view_financial_statements"], keywords: "cash flow statement operating investing financing" },
  { slug: "sales-by-customer", label: "Sales by customer", group: "Sales", href: "/reports/sales-by-customer", access: ["reports.view_financial_statements"], keywords: "customers revenue top clients" },
  { slug: "sales-by-item", label: "Sales by item", group: "Sales", href: "/reports/sales-by-item", access: ["reports.view_financial_statements"], keywords: "catalogue products services quantity" },
  { slug: "receivables", label: "Receivables", group: "Receivables", href: "/receivables", access: ["reports.view_receivables"], keywords: "aging owed customers ar" },
  { slug: "payments-received", label: "Payments received", group: "Receivables", href: "/reports/payments-received", access: ["reports.view_receivables"], keywords: "receipts deposits register customers paid" },
  { slug: "credit-notes-and-refunds", label: "Credit notes and refunds", group: "Receivables", href: "/reports/credit-notes-and-refunds", access: ["reports.view_receivables"], keywords: "credits refunds register customers" },
  { slug: "expenses-by-category", label: "Expenses by category", group: "Purchases", href: "/reports/expenses-by-category", access: ["reports.view_financial_statements"], keywords: "spending costs accounts where money goes" },
  { slug: "purchases-by-vendor", label: "Purchases by vendor", group: "Purchases", href: "/reports/purchases-by-vendor", access: ["reports.view_financial_statements"], keywords: "suppliers bills spend" },
  { slug: "payments-made", label: "Payments made", group: "Purchases", href: "/reports/payments-made", access: ["reports.view_payables"], keywords: "vendor payments cheques register paid" },
  { slug: "vendor-credits-register", label: "Vendor credits", group: "Purchases", href: "/reports/vendor-credits", access: ["reports.view_payables"], keywords: "vendor credits refunds register suppliers" },
  { slug: "payables", label: "Payables", group: "Purchases", href: "/payables", access: ["reports.view_payables"], keywords: "aging owe vendors ap" },
  { slug: "tax-summary", label: "Tax Summary", group: "Tax", href: "/reports/tax-summary", access: ["reports.view_financial_statements"], keywords: "gst vat sales tax" },
  { slug: "gstr-1", label: "GSTR-1", group: "Tax", href: "/reports/gstr-1", access: ["reports.view_financial_statements"], keywords: "gst return gstr1 portal json outward supplies", country: "IN" },
  { slug: "job-profitability", label: "Job profitability", group: "Jobs", href: "/reports/job-profitability", access: ["reports.view_job_profitability"], keywords: "jobs margin" },
  { slug: "general-ledger", label: "General ledger", group: "Accountant", href: "/reports/general-ledger", access: ["ledger.view"], keywords: "gl ledger accounts entries" },
  { slug: "day-book", label: "Day book", group: "Accountant", href: "/reports/day-book", access: ["ledger.view"], keywords: "daybook entries journal ledger" },
  { slug: "journals", label: "Journals", group: "Accountant", href: "/journals", access: ["ledger.view"], keywords: "manual journal adjustments ledger" },
  { slug: "tally", label: "Export to Tally", group: "Accountant", href: "/reports/tally", access: ["reports.view_financial_statements"], keywords: "tally tallyprime erp xml import accountant mapping groups" },
];

export const FINANCIAL_STATEMENTS_NO_ACCESS = "You don't have access to financial statements. Ask an owner.";

/** Whether this member can open the report. */
export function canOpenReport(report: ReportEntry, role: string | null, capabilities: Partial<Record<Capability, boolean>> | null): boolean {
  if (role === "owner") return true;
  if (role !== "staff" || report.access === "owner") return false;
  return report.access.some((c) => capabilities?.[c]);
}

/** Search across names, groups and keywords, ignoring case. */
export function matchesReportSearch(report: ReportEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${report.label} ${report.group} ${report.keywords ?? ""}`.toLowerCase().includes(q);
}

export const favouriteReportsSchema = z.object({
  slugs: z.array(z.string().max(60)).max(50),
});
