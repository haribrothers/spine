import { z } from "zod";
import type { Capability } from "./schemas/permissions.ts";
import type { AttentionKind } from "./schemas/attention.ts";
import type { SearchGroupType } from "./schemas/search.ts";

/**
 * US-SET-23–US-SET-25 (D-154) — the optional parts of Spine an Owner can
 * switch off, and everything each one owns. The API's `ModuleGuard` and the
 * web's `useModules` read this one map, so what's hidden and what's refused
 * never drift apart (tested together). Contacts, catalogue, quotes,
 * invoices, payments, purchases, expenses, banking, accounts, tax and
 * reports are always on. These are runtime settings per business, separate
 * from build-time phase flags (D-068).
 */
export const MODULE_KEYS = ["leadsMeetings", "jobsField", "approvals", "recurring"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type ModuleSettings = Record<ModuleKey, boolean>;

/** `GET /org/modules`: the switches, and since when each switched-off module has been off (YYYY-MM-DD). */
export type ModulesResponse = ModuleSettings & { offSince?: Partial<Record<ModuleKey, string>> };

export const DEFAULT_MODULES: ModuleSettings = { leadsMeetings: true, jobsField: true, approvals: true, recurring: true };

export interface ModuleDefinition {
  label: string;
  description: string;
  /** What it includes, shown under the switch and in the switch-off confirmation. */
  includes: string;
  /** API path patterns (no trailing slash) that answer 403 MODULE_OFF while it's off. */
  routes: RegExp[];
  /** Capabilities that stay granted in Teams but don't show or count while it's off. */
  capabilities: Capability[];
  /** Sidebar items and page paths it owns. */
  pages: string[];
  dashboardWidgets: string[];
  attention: AttentionKind[];
  search: SearchGroupType[];
  notifications: string[];
  settingsPanes: string[];
  reports: string[];
}

const id = "[^/]+";

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  leadsMeetings: {
    label: "Leads & meetings",
    description: "Pipeline board, lead stages, the meetings calendar and their dashboard widgets.",
    includes: "the pipeline, leads, meetings and meeting reminders",
    routes: [/^\/leads(\/|$)/, /^\/meetings(\/|$)/, /^\/org\/lead-stages(\/|$)/, /^\/users\/me\/meeting-reminder-lead-minutes$/],
    capabilities: [
      "leads.open",
      "meetings.open",
      "leads.edit_own",
      "leads.edit_others",
      "leads.delete_own",
      "leads.delete_others",
      "meetings.edit_own",
      "meetings.edit_others",
      "meetings.delete_own",
      "meetings.delete_others",
    ],
    pages: ["/leads", "/meetings"],
    dashboardWidgets: ["pipeline-by-stage"],
    attention: [],
    search: [],
    notifications: ["meeting_invited", "meeting_starting_soon", "meeting_cancelled", "meeting_removed", "meeting_response_changed"],
    settingsPanes: ["lead-stages", "dashboard-meetings-scope", "meeting-reminder-lead-time"],
    reports: [],
  },
  jobsField: {
    label: "Jobs & field",
    description: "Jobs, milestones, retention, variation orders, job costing, crew and the field app.",
    includes: "jobs, milestones, retention, variation orders, job costing, crews and the field app",
    routes: [/^\/jobs(\/|$)/, /^\/reports\/job-profitability(\/|$)/, /^\/dashboard\/retention$/],
    capabilities: [
      "jobs.open",
      "jobs.edit_own",
      "jobs.edit_others",
      "jobs.release_retention",
      "jobs.assign",
      "milestones.edit_own",
      "milestones.edit_others",
      "milestones.invoice",
      "job_notes.edit_own",
      "job_notes.edit_others",
      "job_photos.edit_own",
      "job_photos.edit_others",
      "variation_orders.edit_own",
      "variation_orders.edit_others",
      "variation_orders.apply",
      "reports.view_job_profitability",
    ],
    pages: ["/jobs", "/reports/job-profitability"],
    dashboardWidgets: ["jobs-in-progress", "job-profitability", "retention-held", "my-jobs"],
    attention: ["milestones_to_invoice", "jobs_over_budget", "milestones_due"],
    search: ["jobs"],
    notifications: ["job_completed", "milestone_completed", "variation_order_accepted", "job_photo", "crew_assigned", "crew_removed"],
    settingsPanes: [],
    reports: ["job-profitability"],
  },
  approvals: {
    label: "Approvals",
    description: "Expense approval and quote discount approval. Off: expenses post when submitted and discounts need no approval.",
    includes: "expense approval and quote discount approval",
    routes: [/^\/expenses\/bulk\/approve$/, new RegExp(`^/expenses/${id}/(approve|reject)$`), new RegExp(`^/quotes/${id}/approve-discount$`)],
    capabilities: ["expenses.approve", "expenses.reject", "quotes.approve_discount"],
    pages: [],
    dashboardWidgets: [],
    attention: ["expenses_awaiting_approval", "quotes_discount_approval", "expenses_rejected"],
    search: [],
    notifications: ["expense_approved", "expense_rejected"],
    settingsPanes: [],
    reports: [],
  },
  recurring: {
    label: "Recurring documents",
    description: "Recurring invoices and recurring bills.",
    includes: "recurring invoices and recurring bills",
    routes: [/^\/recurring-invoices(\/|$)/, /^\/recurring-bills(\/|$)/],
    capabilities: ["invoices.manage_recurring", "vendor_bills.manage_recurring"],
    pages: ["/invoices/recurring", "/vendor-bills/recurring"],
    dashboardWidgets: [],
    attention: [],
    search: [],
    notifications: [],
    settingsPanes: [],
    reports: [],
  },
};

export const ALWAYS_ON_NOTE = "Contacts, quotes, invoices, payments, purchases, banking, tax and reports are always on.";
export const MODULE_OFF_ERROR = "MODULE_OFF";

/** "<Module> is switched off. An owner can switch it on in Settings › Modules." */
export function moduleOffMessage(key: ModuleKey): string {
  return `${MODULES[key].label} is switched off. An owner can switch it on in Settings › Modules.`;
}

export const SWITCH_OFF_REASSURANCE = "Nothing is deleted. Switch it back on any time and everything is where you left it.";

/** "<n> people use the field app. Change their role or deactivate them first." */
export const fieldUsersMessage = (n: number) => `${n} ${n === 1 ? "person uses" : "people use"} the field app. Change their role or deactivate them first.`;

/** The saved switches, with every module on unless it was switched off. */
export function resolveModules(saved: Partial<ModuleSettings> | null | undefined): ModuleSettings {
  return { ...DEFAULT_MODULES, ...Object.fromEntries(MODULE_KEYS.filter((k) => typeof saved?.[k] === "boolean").map((k) => [k, saved![k]])) };
}

export const moduleSettingsSchema = z.object(Object.fromEntries(MODULE_KEYS.map((k) => [k, z.boolean()])) as Record<ModuleKey, z.ZodBoolean>).strict();

/** The module that owns an API path, if any (the path without its query string). */
export function moduleForRoute(path: string): ModuleKey | null {
  const clean = path.split("?")[0]!.replace(/\/+$/, "") || "/";
  return MODULE_KEYS.find((k) => MODULES[k].routes.some((r) => r.test(clean))) ?? null;
}

/** The module that owns a web page, if any. */
export function moduleForPage(pathname: string): ModuleKey | null {
  return MODULE_KEYS.find((k) => MODULES[k].pages.some((p) => pathname === p || pathname.startsWith(`${p}/`))) ?? null;
}

/** Whether something owned by a module is usable now. */
export const isOn = (modules: ModuleSettings | null | undefined, key: ModuleKey) => (modules ?? DEFAULT_MODULES)[key];

/** The capabilities of switched-off modules — kept in Teams, but not shown or usable. */
export function capabilitiesOff(modules: ModuleSettings | null | undefined): Set<Capability> {
  return new Set(MODULE_KEYS.filter((k) => !isOn(modules, k)).flatMap((k) => MODULES[k].capabilities));
}

/** Whether a dashboard widget, attention row, search group, notification type, settings pane or report belongs to a switched-off module. */
export function ownedByOffModule(modules: ModuleSettings | null | undefined, kind: "dashboardWidgets" | "attention" | "search" | "notifications" | "settingsPanes" | "reports", key: string): boolean {
  return MODULE_KEYS.some((k) => !isOn(modules, k) && (MODULES[k][kind] as readonly string[]).includes(key));
}

/** Templates that start without Jobs & field (US-ONB-14, US-ONB-20). */
export const TEMPLATES_WITHOUT_JOBS: readonly string[] = ["generic", "professional_services"];

/** US-ONB-14 — the modules an industry template starts with: Generic and Professional services start without jobs; the others with everything. */
export function templateModules(template: string): ModuleSettings {
  return { ...DEFAULT_MODULES, jobsField: !TEMPLATES_WITHOUT_JOBS.includes(template) };
}

export const GENERIC_JOBS_OFF_NOTE = "Jobs are switched off — turn them on in Settings › Modules if you need them.";
export const TEMPLATE_KEEPS_MODULES_NOTE = "Modules stay as they are. Change them in Settings › Modules.";
