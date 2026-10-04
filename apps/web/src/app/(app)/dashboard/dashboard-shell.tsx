"use client";

import { useEffect, useState } from "react";
import { Button, DragHandle, HideToggle, ReorderableItem, ReorderableList, useReorderableItemDragState } from "@spine/ui";
import { DASHBOARD_WIDGETS, mergeDashboardLayout, type DashboardLayout, type DashboardWidgetKey } from "@spine/shared";
import { Check, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { DashboardSummary } from "./dashboard-summary";
import { SetupChecklist } from "./setup-checklist";
import { StorageIntegrityAlert } from "./storage-integrity-alert";
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

const FULL_WIDTH_KEYS = new Set<string>(["activity-feed"]);

/**
 * S-09.12/S-09.13 (dashboard v2) — the role-adaptive, per-user-
 * customizable dashboard composition. `role` is resolved server-side by
 * the caller (`page.tsx`, via `getMyMembership()`) and passed down as a
 * prop, never trusted from the client — see `visibleKeysForRole`'s own
 * comment on why this is a UX decision, not the security boundary.
 *
 * User-redesigned (2026-08): the first cut swapped the whole grid for a
 * separate text-only reorder list in "edit mode," so a user was
 * rearranging blind and only saw the real result after clicking "Done" —
 * confirmed with the user this was the wrong shape. This version drags
 * the REAL widget cards, in place, in the actual grid — "Edit layout"
 * overlays a drag handle + hide toggle onto each card's own corner
 * without replacing it with a placeholder, so what's being edited is
 * always what's actually on the dashboard. `mergeDashboardLayout`
 * (packages/shared, unit-tested) is still the pure function deciding
 * order/visibility; only the editing UI changed.
 *
 * `DashboardSummary` (the KPI row) renders as a PINNED header, above and
 * outside the reorderable grid entirely — per explicit user direction it
 * must never be movable or hideable. It's gated the same way it always
 * was (self-gates to nothing on a 403, so Field/no-
 * `reports.view_dashboard_summary` sessions correctly never see it) but
 * isn't part of the customizable widget set at all, so there's no
 * "Edit layout" affordance on it.
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

  // Editing shows every widget (dimmed if hidden, so a user can find and
  // re-show one) — the normal view shows only what's actually visible.
  const displayed = editing ? merged : merged.filter((entry) => !entry.hidden);

  return (
    <div className="flex flex-col gap-6">
      {role === "owner" && <StorageIntegrityAlert />}
      {role !== "field" && <SetupChecklist />}
      {role !== "field" && <DashboardSummary />}

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? (
            <>
              <Check size={14} /> Done
            </>
          ) : (
            <>
              <Pencil size={14} /> Edit layout
            </>
          )}
        </Button>
      </div>

      <ReorderableList itemIds={displayed.map((e) => e.widgetKey)} onReorder={handleReorder} className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {displayed.map((entry) => {
          const Widget = WIDGET_COMPONENTS[entry.widgetKey as DashboardWidgetKey];
          if (!Widget) return null;
          const fullWidth = FULL_WIDTH_KEYS.has(entry.widgetKey);

          if (!editing) {
            return (
              <div key={entry.widgetKey} className={`flex [&>*]:flex-1 ${fullWidth ? "lg:col-span-2" : ""}`}>
                <Widget />
              </div>
            );
          }

          return (
            <EditableWidgetCard
              key={entry.widgetKey}
              widgetKey={entry.widgetKey}
              fullWidth={fullWidth}
              hidden={entry.hidden}
              onToggleHidden={() => toggleHidden(entry.widgetKey)}
            >
              <Widget />
            </EditableWidgetCard>
          );
        })}
      </ReorderableList>
    </div>
  );
}

function EditableWidgetCard({
  widgetKey,
  fullWidth,
  hidden,
  onToggleHidden,
  children,
}: {
  widgetKey: string;
  fullWidth: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  children: React.ReactNode;
}) {
  const { isOver } = useReorderableItemDragState(widgetKey);

  return (
    <ReorderableItem id={widgetKey} className={`flex ${fullWidth ? "lg:col-span-2" : ""}`}>
      <div className={`relative flex flex-1 flex-col rounded-lg ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <div className={`flex flex-1 flex-col [&>*]:flex-1 ${hidden ? "opacity-40" : ""}`}>{children}</div>
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 shadow-sm">
          <span className="text-[11px] font-medium text-on-surface-muted">{WIDGET_LABELS[widgetKey as DashboardWidgetKey] ?? widgetKey}</span>
          <HideToggle hidden={hidden} onToggle={onToggleHidden} />
          <DragHandle />
        </div>
      </div>
    </ReorderableItem>
  );
}
