import { Banknote, CalendarDays, ClipboardList, FileMinus, FileText, HandCoins, HardHat, Package, Receipt, ReceiptText, Target, Undo2, Users, type LucideIcon } from "lucide-react";
import { SEARCH_SCOPES, type Capability, type SearchGroupType, type SearchScope } from "@spine/shared";
import { t } from "../lib/i18n";

/** US-OPS-47 — each group's icon is its section's icon in the sidebar (`lib/nav-sections.tsx`). */
export const SEARCH_GROUP_ICONS: Record<SearchGroupType, LucideIcon> = {
  contacts: Users,
  leads: Target,
  meetings: CalendarDays,
  catalog_items: Package,
  quotes: FileText,
  jobs: HardHat,
  invoices: Receipt,
  credit_notes: Undo2,
  payments: Banknote,
  vendor_bills: ClipboardList,
  vendor_credits: FileMinus,
  vendor_payments: HandCoins,
  expenses: ReceiptText,
};

/** The sidebar page each group's records live on — a group is searchable when its page is in this person's sidebar. */
export const SEARCH_GROUP_PAGE: Record<SearchGroupType, string> = {
  contacts: "/contacts",
  leads: "/leads",
  meetings: "/meetings",
  catalog_items: "/catalog",
  quotes: "/quotes",
  jobs: "/jobs",
  invoices: "/invoices",
  credit_notes: "/credit-notes",
  payments: "/payments",
  vendor_bills: "/vendor-bills",
  vendor_credits: "/vendor-credits",
  vendor_payments: "/vendor-payments",
  expenses: "/expenses",
};

/** What "See all … matching" and "You can search …" call each group. */
export const SEARCH_GROUP_NOUNS: Record<SearchGroupType, string> = {
  contacts: t("common.search.nouns.contacts"),
  leads: t("common.search.nouns.leads"),
  meetings: t("common.search.nouns.meetings"),
  catalog_items: t("common.search.nouns.catalogItems"),
  quotes: t("common.search.nouns.quotes"),
  jobs: t("common.search.nouns.jobs"),
  invoices: t("common.search.nouns.invoices"),
  credit_notes: t("common.search.nouns.creditNotes"),
  payments: t("common.search.nouns.payments"),
  vendor_bills: t("common.search.nouns.vendorBills"),
  vendor_credits: t("common.search.nouns.vendorCredits"),
  vendor_payments: t("common.search.nouns.vendorPayments"),
  expenses: t("common.search.nouns.expenses"),
};

/** US-OPS-49 — the area each group belongs to. */
export const SEARCH_GROUP_SCOPE = Object.fromEntries(
  (Object.entries(SEARCH_SCOPES) as [SearchScope, readonly SearchGroupType[]][]).flatMap(([scope, groups]) => groups.map((g) => [g, scope])),
) as Record<SearchGroupType, SearchScope>;

/** US-OPS-41 — more words each sidebar page is found by. */
export const PAGE_KEYWORDS: Record<string, string> = {
  "/dashboard": "home overview",
  "/contacts": "customers vendors suppliers clients",
  "/leads": "leads deals opportunities",
  "/meetings": "calendar appointments",
  "/catalog": "items products services price list",
  "/quotes": "estimates proposals",
  "/invoices": "sales billing",
  "/credit-notes": "credits refunds",
  "/payments": "receipts payments received",
  "/receivables": "unpaid invoices owed aging ar",
  "/vendor-bills": "bills purchases",
  "/vendor-credits": "vendor credit notes",
  "/expenses": "spending claims receipts",
  "/vendor-payments": "payments made pay vendors",
  "/payables": "unpaid bills owed ap",
  "/banking": "bank accounts reconcile transfers",
  "/reports": "reports",
  "/journals": "manual journals ledger",
  "/team/users": "people invite",
  "/team/teams": "permissions roles",
  "/team/audit-log": "history changes",
};

export interface SearchAction {
  key: string;
  /** As on its page's button. */
  label: string;
  /** The sidebar area, shown as the second line. */
  area: string;
  /** Opens the same form the page's button opens. */
  href: string;
  /** The right to create it (the section's Open permission is checked through the page). */
  capability: Capability;
  /** More words it's found by. */
  words: string;
}

/** US-OPS-42 — "new" actions, in the sidebar's order. */
export const SEARCH_ACTIONS: SearchAction[] = [
  { key: "contact", label: t("common.search.actions.contact"), area: t("common.nav.sections.sales"), href: "/contacts?new=1", capability: "contacts.edit_own", words: "new create customer vendor" },
  { key: "lead", label: t("common.search.actions.lead"), area: t("common.nav.sections.sales"), href: "/leads?new=1", capability: "leads.edit_own", words: "new create deal opportunity pipeline" },
  { key: "meeting", label: t("common.search.actions.meeting"), area: t("common.nav.sections.sales"), href: "/meetings?new=1", capability: "meetings.edit_own", words: "add create schedule appointment" },
  { key: "item", label: t("common.search.actions.item"), area: t("common.nav.sections.sales"), href: "/catalog?new=1", capability: "catalog.edit_own", words: "new create product service" },
  { key: "quote", label: t("common.search.actions.quote"), area: t("common.nav.sections.sales"), href: "/quotes/new", capability: "quotes.edit_own", words: "add create estimate" },
  { key: "job", label: t("common.search.actions.job"), area: t("common.nav.sections.jobs"), href: "/jobs?new=1", capability: "jobs.edit_own", words: "add create project" },
  { key: "invoice", label: t("common.search.actions.invoice"), area: t("common.nav.sections.billing"), href: "/invoices/new", capability: "invoices.edit_own", words: "add create raise" },
  { key: "payment", label: t("common.search.actions.payment"), area: t("common.nav.sections.billing"), href: "/payments?new=1", capability: "payments.edit_own", words: "new add receive receipt" },
  { key: "vendor-bill", label: t("common.search.actions.vendorBill"), area: t("common.nav.sections.purchases"), href: "/vendor-bills/new", capability: "vendor_bills.edit_own", words: "add create record bill" },
  { key: "vendor-credit", label: t("common.search.actions.vendorCredit"), area: t("common.nav.sections.purchases"), href: "/vendor-credits/new", capability: "vendor_credits.edit_own", words: "add create record" },
  { key: "vendor-payment", label: t("common.search.actions.vendorPayment"), area: t("common.nav.sections.purchases"), href: "/vendor-payments?new=1", capability: "vendor_payments.edit_own", words: "new add pay bill" },
  { key: "expense", label: t("common.search.actions.expense"), area: t("common.nav.sections.purchases"), href: "/expenses?new=1", capability: "expenses.edit_own", words: "new add create claim receipt" },
];

/** The words in a phrase: "Record vendor payment" → ["record", "vendor", "payment"]. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** US-OPS-41 — every typed word starts a word of the text: "new inv" finds "New invoice", "har" doesn't find "Charts". */
export function matchesWordStarts(text: string, query: string): boolean {
  const have = words(text);
  const want = words(query);
  return want.length > 0 && want.every((w) => have.some((h) => h.startsWith(w)));
}

/** "Record vendor payment" — for the label, or the label with its extra words. */
export function actionMatches(action: SearchAction, query: string): boolean {
  return matchesWordStarts(`${action.label} ${action.words}`, query);
}
