import { REPORTS } from "@spine/shared";
import { t } from "./i18n";

/**
 * US-OPS-54 (D-283) — the phone layout's areas: which bottom tab a page belongs to, the
 * pages in each area's row, the title in the top bar and whether it has a back arrow.
 * Pure functions of the path, so the shell, the tests and the sidebar agree.
 */

export type AreaKey = "home" | "sales" | "jobs" | "money" | "more";

export interface Area {
  key: Exclude<AreaKey, "more">;
  /** The pages in the area's row, in order; the first is where the tab opens the first time. */
  pages: string[];
  /** Pages that belong to the area but aren't in its row. */
  alsoIn?: string[];
}

export const AREAS: Area[] = [
  { key: "home", pages: ["/dashboard"] },
  { key: "sales", pages: ["/quotes", "/contacts", "/leads", "/meetings", "/catalog"] },
  { key: "jobs", pages: ["/jobs"] },
  {
    key: "money",
    pages: ["/invoices", "/payments", "/receivables", "/credit-notes", "/vendor-bills", "/expenses", "/payables", "/banking", "/reports"],
    alsoIn: ["/vendor-credits", "/vendor-payments", "/journals", "/opening-balances", "/emails"],
  },
];

const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** The tab a page belongs to; pages in no area (Team, Activity, Profile, Set up) belong to More. */
export function areaFor(path: string): AreaKey {
  for (const area of AREAS) if ([...area.pages, ...(area.alsoIn ?? [])].some((base) => within(path, base))) return area.key;
  return "more";
}

/** An area's row: its pages the person can open (`shown` is the sidebar's hrefs). */
export function areaPages(key: AreaKey, shown: ReadonlySet<string>): string[] {
  return AREAS.find((a) => a.key === key)?.pages.filter((href) => shown.has(href)) ?? [];
}

/**
 * The tabs this person gets: an area with no page they can open isn't one (More always is).
 * A Field member never gets Money (US-OPS-54, "Field users never reach … other people's
 * money"): their own expenses are under More.
 */
export function visibleAreas(shown: ReadonlySet<string>, role?: string | null): AreaKey[] {
  return [...AREAS.filter((a) => !(role === "field" && a.key === "money") && a.pages.some((href) => shown.has(href))).map((a) => a.key), "more"];
}

/** A page from the sidebar (an area's first level) has no back arrow; anything below one has. */
export function isTopLevel(path: string, shown: ReadonlySet<string>): boolean {
  return shown.has(path) || path === "/dashboard";
}

/** Where the back arrow goes when there's no page of Spine's to go back to. */
export function parentPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "reports") return "/reports";
  if (parts[0] === "team" && parts.length > 2) return `/${parts[0]}/${parts[1]}`;
  if (parts[0] === "banking" && parts.length > 2) return `/banking/${parts[1]}`;
  if (parts.length <= 1) return "/dashboard";
  return `/${parts[0]}`;
}

/** Record and builder pages, by pattern; `:id` is any one segment. */
const TITLES: [RegExp, () => string][] = [
  [/^\/contacts\/new$/, () => t("common.phone.titles.newContact")],
  [/^\/contacts\/[^/]+$/, () => t("common.phone.titles.contact")],
  [/^\/quotes\/new$/, () => t("common.phone.titles.newQuote")],
  [/^\/quotes\/[^/]+\/edit$/, () => t("common.phone.titles.editQuote")],
  [/^\/quotes\/[^/]+$/, () => t("common.phone.titles.quote")],
  [/^\/invoices\/new$/, () => t("common.phone.titles.newInvoice")],
  [/^\/invoices\/recurring$/, () => t("common.phone.titles.recurringInvoices")],
  [/^\/invoices\/[^/]+\/edit$/, () => t("common.phone.titles.editInvoice")],
  [/^\/invoices\/[^/]+$/, () => t("common.phone.titles.invoice")],
  [/^\/jobs\/[^/]+$/, () => t("common.phone.titles.job")],
  [/^\/payments\/[^/]+$/, () => t("common.phone.titles.payment")],
  [/^\/credit-notes\/[^/]+$/, () => t("common.phone.titles.creditNote")],
  [/^\/expenses\/categories$/, () => t("common.phone.titles.expenseCategories")],
  [/^\/expenses\/[^/]+$/, () => t("common.phone.titles.expense")],
  [/^\/vendor-bills\/new$/, () => t("common.phone.titles.newVendorBill")],
  [/^\/vendor-bills\/recurring$/, () => t("common.phone.titles.recurringBills")],
  [/^\/vendor-bills\/[^/]+\/edit$/, () => t("common.phone.titles.editVendorBill")],
  [/^\/vendor-bills\/[^/]+$/, () => t("common.phone.titles.vendorBill")],
  [/^\/vendor-credits\/new$/, () => t("common.phone.titles.newVendorCredit")],
  [/^\/vendor-credits\/[^/]+\/edit$/, () => t("common.phone.titles.editVendorCredit")],
  [/^\/vendor-credits\/[^/]+$/, () => t("common.phone.titles.vendorCredit")],
  [/^\/vendor-payments\/[^/]+$/, () => t("common.phone.titles.vendorPayment")],
  [/^\/banking\/[^/]+\/reconcile$/, () => t("common.phone.titles.reconcile")],
  [/^\/banking\/[^/]+\/reconciliations(\/[^/]+)?$/, () => t("common.phone.titles.reconciliations")],
  [/^\/banking\/[^/]+$/, () => t("common.phone.titles.bankAccount")],
  [/^\/journals\/[^/]+$/, () => t("common.phone.titles.journal")],
  [/^\/team\/teams\/[^/]+$/, () => t("common.phone.titles.team")],
  [/^\/reports\/tally\/mapping$/, () => t("common.phone.titles.tallyMapping")],
  [/^\/activity$/, () => t("common.phone.titles.activity")],
  [/^\/profile$/, () => t("common.phone.titles.profile")],
  [/^\/setup$/, () => t("common.phone.titles.setup")],
  [/^\/opening-balances$/, () => t("common.phone.titles.openingBalances")],
  [/^\/emails$/, () => t("common.phone.titles.emails")],
];

/** The top bar's title: the sidebar's name for the page, a report's name, or the record's kind ("Invoice"). */
export function titleFor(path: string, navLabels: ReadonlyMap<string, string>): string {
  const nav = navLabels.get(path);
  if (nav) return nav;
  const report = REPORTS.find((r) => r.href === path);
  if (report) return report.label;
  const match = TITLES.find(([pattern]) => pattern.test(path));
  if (match) return match[1]();
  // A page this list doesn't know: the sidebar's name for the section it's in.
  const section = [...navLabels.keys()].filter((href) => within(path, href)).sort((a, b) => b.length - a.length)[0];
  return section ? navLabels.get(section)! : t("common.phone.titles.spine");
}

/** Builders fill the screen without the tab bar (US-OPS-59): new and edit pages. */
export function isBuilder(path: string): boolean {
  return /\/(new|edit)$/.test(path);
}

const LAST_KEY = "spine.phone.lastPage.";

/**
 * Remembers which of an area's pages was last open (Invoices or Payments, with its filters),
 * so its tab opens there (US-OPS-54). Records aren't remembered: tapping Money from an
 * invoice goes back to the list it came from. Call from an effect: it reads storage.
 */
export function rememberAreaPage(path: string, search = "") {
  const area = AREAS.find((a) => a.key !== "home" && a.pages.includes(path));
  if (!area) return;
  try {
    window.sessionStorage.setItem(LAST_KEY + area.key, path + search);
  } catch {
    // Private windows can refuse storage; the tab then opens the area's first page.
  }
}

/** Where an area's tab goes: the page last used there, else its first page this person can open. Reads storage: call after mount. */
export function areaHref(key: AreaKey, shown: ReadonlySet<string>): string {
  if (key === "home") return "/dashboard";
  let last: string | null = null;
  try {
    last = window.sessionStorage.getItem(LAST_KEY + key);
  } catch {
    last = null;
  }
  const lastPath = last?.split("?")[0];
  if (last && lastPath && areaFor(lastPath) === key && shown.has(lastPath)) return last;
  return areaPages(key, shown)[0] ?? "/dashboard";
}
