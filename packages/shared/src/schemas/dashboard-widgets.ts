import { z } from "zod";
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
 *
 * The KPI summary row (S-09.10, cash/receivables/overdue/revenue) is
 * DELIBERATELY not a member of this list — per explicit user direction it
 * must never be movable or hideable, so `DashboardShell` renders it as a
 * pinned header outside the reorderable set entirely, not as a widget
 * with drag/hide disabled. Keeping it out of the registry (rather than
 * adding a `locked: true` flag some widgets could set) means the
 * customizable set and the pinned set are structurally distinct — there's
 * no code path that could accidentally make it draggable.
 */
export const DASHBOARD_WIDGETS = [
  // US-DASH-23 — every bank, cash and card balance.
  { key: "accounts", capability: "banking.view" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  // US-DASH-21 — what's owed to vendors, beside receivables (D-160).
  { key: "payables", capability: "reports.view_payables" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  // US-DASH-24 — work done that could be invoiced today.
  { key: "ready-to-bill", capability: "reports.view_receivables" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  // US-DASH-22 — the largest expense accounts for a period.
  { key: "top-expenses", capability: "reports.view_financial_statements" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  { key: "money-in-out", capability: "reports.view_dashboard_summary" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  { key: "pipeline-by-stage", capability: null, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  // US-DASH-20 — shown by default only for the Construction template; elsewhere they start hidden.
  { key: "retention-held", capability: "reports.view_receivables" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: true },
  { key: "jobs-in-progress", capability: "reports.view_job_profitability" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: true },
  { key: "ar-aging", capability: "reports.view_receivables" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  { key: "job-profitability", capability: "reports.view_job_profitability" as Capability, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  { key: "activity-feed", capability: null, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  { key: "invoices-due", capability: null, ownerOnly: false, fieldOnly: false, constructionDefault: false },
  // US-DASH-18 — a Field user's own cards.
  { key: "my-jobs", capability: null, ownerOnly: false, fieldOnly: true, constructionDefault: false },
  { key: "my-expenses", capability: null, ownerOnly: false, fieldOnly: true, constructionDefault: false },
  { key: "my-activity", capability: null, ownerOnly: false, fieldOnly: true, constructionDefault: false },
] as const satisfies readonly { key: string; capability: Capability | null; ownerOnly: boolean; fieldOnly: boolean; constructionDefault: boolean }[];

/** US-DASH-20 — widgets that start hidden unless the organisation uses the Construction template. */
export function defaultHiddenWidgets(template: string | null | undefined): string[] {
  return template === "construction" ? [] : DASHBOARD_WIDGETS.filter((w) => w.constructionDefault).map((w) => w.key);
}

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];

/**
 * S-09.13 — the shape of `user.dashboardLayout`. `widgetKey` is
 * deliberately `z.string()`, not `z.enum(...)` against the registry above
 * — a stale/removed key must be storable (this schema only validates
 * "well-formed," not "currently valid"), otherwise a user could get stuck
 * unable to save any new layout change after a widget is removed from the
 * registry until they first clear out the stale key. Skipping an unknown
 * key happens at read/merge time (`DashboardShell`), not here.
 */
export const dashboardLayoutEntrySchema = z.object({
  widgetKey: z.string(),
  position: z.number().int().min(0),
  hidden: z.boolean(),
});

export const dashboardLayoutSchema = z.array(dashboardLayoutEntrySchema);

export type DashboardLayoutEntry = z.infer<typeof dashboardLayoutEntrySchema>;
export type DashboardLayout = DashboardLayoutEntry[];

/**
 * S-09.13 — merges a saved `dashboardLayout` against the registry and the
 * viewer's own visible-widget set for this render, producing the ordered
 * list `DashboardShell` actually composes. A pure function (no React, no
 * fetch) so it's directly unit-testable, independent of the component
 * that calls it.
 *
 * Rules, in order:
 * 1. Any saved entry whose `widgetKey` isn't in `visibleKeys` (either not
 *    in the registry at all — a removed/renamed widget — or not visible
 *    to this viewer's role/capabilities this render) is dropped entirely.
 * 2. Remaining saved entries are sorted by `position`.
 * 3. Any `visibleKeys` entry with no saved entry (a widget added to the
 *    registry since the user last saved, or a first-time viewer with no
 *    saved layout at all) is appended at the end, in registry order,
 *    marked not hidden — unless it's in `defaultHidden` (US-DASH-20).
 */
export function mergeDashboardLayout(
  saved: DashboardLayout | null,
  visibleKeys: readonly string[],
  defaultHidden: readonly string[] = [],
): { widgetKey: string; hidden: boolean }[] {
  const visibleSet = new Set(visibleKeys);
  const savedByKey = new Map((saved ?? []).filter((entry) => visibleSet.has(entry.widgetKey)).map((entry) => [entry.widgetKey, entry]));

  const ordered = Array.from(savedByKey.values())
    .sort((a, b) => a.position - b.position)
    .map((entry) => ({ widgetKey: entry.widgetKey, hidden: entry.hidden }));

  for (const key of visibleKeys) {
    if (!savedByKey.has(key)) {
      ordered.push({ widgetKey: key, hidden: defaultHidden.includes(key) });
    }
  }

  return ordered;
}
