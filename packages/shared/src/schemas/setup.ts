import { z } from "zod";

/**
 * US-ONB-15, US-ONB-16 (D-155, D-194) — the Set up Spine page: one card per
 * thing a new business sets up, in the order the page shows them. Whether
 * a card is done is worked out from the business's data on the server
 * (`GET /org/setup-status`); this list is what the page says and where
 * each card leads.
 */
export const SETUP_CARD_KEYS = [
  "business",
  "tax",
  "accounts",
  "opening_balances",
  "bank_accounts",
  "payment_instructions",
  "documents",
  "numbering",
  "reminders",
  "modules",
  "team",
  "email",
  "backups",
  "field_app",
] as const;
export type SetupCardKey = (typeof SETUP_CARD_KEYS)[number];

/** Where "Set up" / "Review" goes: a Settings pane (opened over the page), an app page, or the self-hosting guide. */
export type SetupTarget = { settings: string } | { page: string } | { guide: "self_hosting" };

export interface SetupCardDefinition {
  title: string;
  /** One line on why it matters. */
  why: string;
  target: SetupTarget;
  /** The user-guide page for "How it works" (bundled help, US-SITE-11; shown once `FEATURE_FLAGS.bundledHelp` is on). */
  guide: string;
}

export const SETUP_CARDS: Record<SetupCardKey, SetupCardDefinition> = {
  business: { title: "Business details and logo", why: "Shown on every quote, invoice and email.", target: { settings: "business" }, guide: "/help/guide/settings/business-profile/" },
  tax: { title: "Tax", why: "Your country's rates, and GST details in India.", target: { settings: "tax" }, guide: "/help/guide/tax/" },
  accounts: { title: "Chart of accounts", why: "Add the income and expense accounts you report on.", target: { settings: "accounts" }, guide: "/help/guide/accounts/chart-of-accounts/" },
  opening_balances: { title: "Opening balances", why: "What you had on the day you started — so the Balance Sheet is right.", target: { page: "/opening-balances" }, guide: "/help/guide/accounts/opening-balances/" },
  bank_accounts: { title: "Bank and cash accounts", why: "Record money where it really is, then reconcile.", target: { page: "/banking" }, guide: "/help/guide/banking/" },
  payment_instructions: { title: "Payment instructions", why: "How customers pay you — bank details and UPI ID.", target: { settings: "payment-instructions" }, guide: "/help/guide/invoices/payment-instructions/" },
  documents: { title: "Documents and emails", why: "Paper size, terms, signature and the words in your emails.", target: { settings: "documents" }, guide: "/help/guide/settings/documents/" },
  numbering: { title: "Numbering", why: "Continue your existing invoice numbers.", target: { settings: "numbering" }, guide: "/help/guide/settings/numbering/" },
  reminders: { title: "Payment reminders", why: "Chase overdue invoices automatically.", target: { settings: "reminders" }, guide: "/help/guide/invoices/reminders/" },
  modules: { title: "Modules", why: "Switch off what you don't use.", target: { settings: "modules" }, guide: "/help/guide/settings/modules/" },
  team: { title: "Invite your team", why: "Office staff and field crew sign in with their own accounts.", target: { page: "/team/users" }, guide: "/help/guide/team/" },
  email: { title: "Email sending", why: "Set by whoever runs the server — see the self-hosting guide.", target: { guide: "self_hosting" }, guide: "/help/self-hosting/email/" },
  backups: { title: "Backups", why: "Off-site backups protect your books if the server dies.", target: { guide: "self_hosting" }, guide: "/help/self-hosting/backups/" },
  field_app: { title: "Field app", why: "Crews see their jobs and send photos and expenses.", target: { page: "/team/users" }, guide: "/help/guide/field-app/" },
};

/**
 * Where the self-hosting guide lives until the docs site ships (US-SITE-*,
 * Q-15): the README's "Production / self-hosting" section.
 */
export const SELF_HOSTING_GUIDE_URL = "https://github.com/haribrothers/spine#production--self-hosting";

/** Said on the Backups card until Phase 12 can tell whether a backup ran (D-194). */
export const BACKUPS_NOT_TRACKED_NOTE = "Spine can't check backups yet — whoever runs the server sets them up. Not counted below.";

export const SETUP_DEMO_NOTE = "Demo data is loaded — these reflect the demo business. Delete it in Settings › Data to set up your own.";

export interface SetupCardStatus {
  key: SetupCardKey;
  /** Worked out from data; null when Spine can't tell (Backups, D-194). */
  done: boolean | null;
  /** Marked "not needed" for this organisation. */
  hidden: boolean;
}

/** `GET /org/setup-status`. Cards that don't apply (Field app with Jobs & field off) are left out. */
export interface SetupStatus {
  cards: SetupCardStatus[];
  demoLoaded: boolean;
}

export const setSetupHiddenSchema = z.object({ hidden: z.boolean() }).strict();

/** "8 of 14 done": counts only the cards Spine can check and that aren't hidden. */
export function setupProgress(cards: readonly SetupCardStatus[]): { done: number; total: number; toDo: number; notNeeded: number } {
  const counted = cards.filter((c) => !c.hidden && c.done !== null);
  const done = counted.filter((c) => c.done).length;
  return { done, total: counted.length, toDo: counted.length - done, notNeeded: cards.filter((c) => c.hidden).length };
}

/** "Finish setting up Spine — 3 left" on the dashboard checklist. */
export const finishSettingUpLabel = (left: number) => `Finish setting up Spine — ${left} left`;
