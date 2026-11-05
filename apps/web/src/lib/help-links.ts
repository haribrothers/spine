import { SPINE_DOCS_URL } from "@spine/shared";

/**
 * US-SITE-11 (D-110) — which guide page "Help for this page" opens. The
 * guide for this install's version is served by the server itself at
 * /help (US-SITE-12), so it works without internet. Longest prefix wins;
 * a page with no guide of its own opens the guide's start page.
 */
export const HELP_BASE = "/help/";
export const ONLINE_DOCS_URL = SPINE_DOCS_URL;

const ROUTES: [prefix: string, guide: string][] = [
  ["/dashboard", "guide/dashboard/"],
  ["/setup", "guide/setup/"],
  ["/contacts", "guide/contacts/"],
  ["/leads", "guide/contacts/"],
  ["/meetings", "guide/meetings/"],
  ["/catalog", "guide/catalogue/"],
  ["/quotes", "guide/quotes/"],
  ["/jobs", "guide/jobs/"],
  ["/invoices", "guide/invoices/"],
  ["/credit-notes", "guide/invoices/"],
  ["/payments", "guide/payments/"],
  ["/receivables", "guide/payments/"],
  ["/banking", "guide/banking/"],
  ["/vendor-bills", "guide/purchases/"],
  ["/vendor-credits", "guide/purchases/"],
  ["/vendor-payments", "guide/purchases/"],
  ["/payables", "guide/purchases/"],
  ["/expenses", "guide/purchases/"],
  ["/reports/tax-summary", "guide/tax/"],
  ["/reports/gstr-1", "guide/tax/"],
  ["/reports", "guide/reports/"],
  ["/journals", "guide/reports/"],
  ["/opening-balances", "guide/accounts/opening-balances/"],
  ["/team", "guide/team/"],
  ["/emails", "guide/settings/"],
  ["/profile", "guide/settings/"],
];

/** The guide page (under /help/) for a page of the app. */
export function helpPathFor(pathname: string): string {
  const match = ROUTES.filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  return `${HELP_BASE}${match ? match[1] : "guide/"}`;
}

/** The release notes for a version ("What's new"). */
export function releaseNotesUrl(version: string): string {
  return `https://github.com/haribrothers/spine/releases/tag/v${version}`;
}
