import { z } from "zod";
import type { Capability } from "./permissions.ts";

/**
 * US-RPT-23 — every report, grouped as the Reports page shows them, with
 * who can open each. Owners open everything; Field never; Staff need one of
 * `anyOf`. A report joins this list when its story ships.
 */

export const REPORT_GROUPS = ["Business overview", "Sales", "Receivables", "Purchases", "Tax", "Jobs", "Accountant"] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export interface ReportEntry {
  slug: string;
  label: string;
  group: ReportGroup;
  href: string;
  /** "owner" until the report opens to a Team right (US-RPT-36). */
  access: "owner" | Capability[];
  /** Extra words the search matches. */
  keywords?: string;
}

export const REPORTS: ReportEntry[] = [
  { slug: "profit-and-loss", label: "Profit & Loss", group: "Business overview", href: "/reports/profit-and-loss", access: "owner", keywords: "income statement p&l pl" },
  { slug: "balance-sheet", label: "Balance Sheet", group: "Business overview", href: "/reports/balance-sheet", access: "owner", keywords: "assets liabilities equity" },
  { slug: "trial-balance", label: "Trial Balance", group: "Business overview", href: "/reports/trial-balance", access: "owner", keywords: "tb debits credits ledger" },
  { slug: "receivables", label: "Receivables", group: "Receivables", href: "/receivables", access: ["reports.view_receivables"], keywords: "aging owed customers ar" },
  { slug: "payables", label: "Payables", group: "Purchases", href: "/payables", access: ["reports.view_payables"], keywords: "aging owe vendors ap" },
  { slug: "tax-summary", label: "Tax Summary", group: "Tax", href: "/reports/tax-summary", access: "owner", keywords: "gst vat sales tax" },
  { slug: "job-profitability", label: "Job profitability", group: "Jobs", href: "/reports/job-profitability", access: ["reports.view_job_profitability"], keywords: "jobs margin" },
  { slug: "general-ledger", label: "General ledger", group: "Accountant", href: "/reports/general-ledger", access: ["ledger.view"], keywords: "gl ledger accounts entries" },
  { slug: "journals", label: "Journals", group: "Accountant", href: "/journals", access: ["ledger.view"], keywords: "manual journal adjustments ledger" },
];

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
