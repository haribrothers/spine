import type { Capability } from "./permissions.ts";

/**
 * S-09.11 → S-09.14 (dashboard v2) — the stable list of dashboard widget
 * keys, single source of truth for both the role-adaptive `DashboardShell`
 * (which widgets exist to compose) and Stage 5's per-user layout
 * persistence (which keys a saved `dashboardLayout` may reference). A
 * saved layout entry whose `widgetKey` isn't in this list — a removed or
 * renamed widget — is skipped at merge time rather than surfacing a
 * broken widget; see `dashboard-shell.tsx`'s own layout-merge logic.
 *
 * `capability`/`ownerOnly` here are documentation and web-layer UX aids
 * ONLY (avoid rendering a widget that will just 403) — never the security
 * boundary. Each widget's own data endpoint enforces its real gate
 * server-side, exactly matching this codebase's existing report/capability
 * pattern; `null` means "every authenticated org member" (session-only,
 * or — for `activity-feed` — the server does its own role-filtering
 * internally rather than gating the whole route).
 */
export const DASHBOARD_WIDGETS = [
  { key: "kpi-summary", capability: "dashboard.view" as Capability, ownerOnly: false },
  { key: "revenue-trend", capability: "dashboard.view" as Capability, ownerOnly: true },
  { key: "pipeline-by-stage", capability: "contacts.manage" as Capability, ownerOnly: false },
  { key: "ar-aging", capability: "dashboard.view" as Capability, ownerOnly: false },
  { key: "job-profitability", capability: "dashboard.view" as Capability, ownerOnly: false },
  { key: "overdue-followups", capability: null, ownerOnly: false },
  { key: "upcoming-meetings", capability: null, ownerOnly: false },
  { key: "invoices-due", capability: "invoices.manage" as Capability, ownerOnly: false },
  { key: "milestones-due", capability: "jobs.update_milestones" as Capability, ownerOnly: false },
  { key: "activity-feed", capability: null, ownerOnly: false },
] as const satisfies readonly { key: string; capability: Capability | null; ownerOnly: boolean }[];

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];
