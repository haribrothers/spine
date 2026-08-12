"use client";

import { useEffect, useState } from "react";
import { Button, ReorderableItem, ReorderableList, Spinner } from "@spine/ui";
import { DASHBOARD_WIDGETS, mergeDashboardLayout, type DashboardLayout, type DashboardWidgetKey } from "@spine/shared";
import { LayoutGrid, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { SetupChecklist } from "./setup-checklist";
import { WIDGET_COMPONENTS, WIDGET_LABELS } from "./widget-registry";

/**
 * S-09.12's per-role visible set. `capability`/`ownerOnly` on
 * `DASHBOARD_WIDGETS` are documentation/UX hints (never the real gate —
 * each widget's own data endpoint enforces that server-side), so this is
 * the same UX-only judgment call already made in Stage 3: Owner sees
 * everything, Staff sees everything except the Owner-only chart, Field
 * sees only the 4 widgets that have no financial capability attached.
 */
function visibleKeysForRole(role: string | null): DashboardWidgetKey[] {
  if (role === "field") {
    return ["overdue-followups", "upcoming-meetings", "milestones-due", "activity-feed"];
  }
  return DASHBOARD_WIDGETS.filter((w) => role === "owner" || !w.ownerOnly).map((w) => w.key);
}

/**
 * S-09.12/S-09.13 (dashboard v2) — the role-adaptive, per-user-
 * customizable dashboard composition. `role` is resolved server-side by
 * the caller (`page.tsx`, via `getMyMembership()`) and passed down as a
 * prop, never trusted from the client — see `visibleKeysForRole`'s own
 * comment on why this is a UX decision, not the security boundary (every
 * widget still independently self-gates on its own data endpoint's
 * 403/error).
 *
 * Layout is a single flat responsive grid (2 columns on desktop, 1 on
 * mobile), auto-flowing in whichever order the merged layout produces —
 * not hand-curated 2-up pairs, since arbitrary per-user reordering can't
 * preserve a fixed pairing anyway (confirmed with the user before
 * building this). `mergeDashboardLayout` (packages/shared, unit-tested)
 * is the pure function deciding the actual order/visibility for this
 * render — this component only fetches the saved layout, computes the
 * viewer's visible set, and renders.
 */
export function DashboardShell({ role }: { role: string | null }) {
  const [savedLayout, setSavedLayout] = useState<DashboardLayout | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ layout: DashboardLayout | null }>("/users/me/dashboard-layout")
      .then((res) => setSavedLayout(res.layout))
      .catch(() => setSavedLayout(null));
  }, []);

  const visibleKeys = visibleKeysForRole(role);
  const merged = savedLayout === undefined ? visibleKeys.map((key) => ({ widgetKey: key, hidden: false })) : mergeDashboardLayout(savedLayout, visibleKeys);

  async function persist(next: { widgetKey: string; hidden: boolean }[]) {
    const layout: DashboardLayout = next.map((entry, i) => ({ widgetKey: entry.widgetKey, position: i, hidden: entry.hidden }));
    setSavedLayout(layout);
    await apiClient.put("/users/me/dashboard-layout", layout);
  }

  function handleReorder(newOrder: string[]) {
    const byKey = new Map(merged.map((entry) => [entry.widgetKey, entry]));
    void persist(newOrder.map((key) => byKey.get(key)!));
  }

  function toggleHidden(widgetKey: string) {
    void persist(merged.map((entry) => (entry.widgetKey === widgetKey ? { ...entry, hidden: !entry.hidden } : entry)));
  }

  const visible = merged.filter((entry) => !entry.hidden);

  return (
    <div className="flex flex-col gap-6">
      {role !== "field" && <SetupChecklist />}

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? (
            <>
              <LayoutGrid size={14} /> Done
            </>
          ) : (
            <>
              <Pencil size={14} /> Customize dashboard
            </>
          )}
        </Button>
      </div>

      {editing && savedLayout === undefined ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : editing ? (
        <ReorderableList itemIds={merged.map((e) => e.widgetKey)} onReorder={handleReorder} className="max-w-lg">
          {merged.map((entry) => (
            <ReorderableItem key={entry.widgetKey} id={entry.widgetKey} hidden={entry.hidden} onToggleHidden={() => toggleHidden(entry.widgetKey)}>
              {WIDGET_LABELS[entry.widgetKey as DashboardWidgetKey] ?? entry.widgetKey}
            </ReorderableItem>
          ))}
        </ReorderableList>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((entry) => {
            const Widget = WIDGET_COMPONENTS[entry.widgetKey as DashboardWidgetKey];
            if (!Widget) return null;
            const fullWidth = entry.widgetKey === "kpi-summary" || entry.widgetKey === "activity-feed";
            return (
              <div key={entry.widgetKey} className={fullWidth ? "lg:col-span-2" : ""}>
                <Widget />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
