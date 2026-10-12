"use client";

import { useEffect, useState } from "react";
import {
  AppShellHeader,
  Button,
  DragHandle,
  HideToggle,
  ReorderableItem,
  ReorderableList,
  cn,
  useReorderableItemDragState,
} from "@spine/ui";
import {
  DASHBOARD_WIDGETS,
  attentionSummary,
  defaultHiddenWidgets,
  fieldSummary,
  greetingFor,
  mergeDashboardLayout,
  type AttentionItem,
  type Capability,
  type DashboardLayout,
  type DashboardWidgetKey,
  type ModuleSettings,
  ownedByOffModule,
} from "@spine/shared";
import { useModules } from "../../../lib/modules-context";
import { Check, Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { KpiRow } from "./kpi-row";
import { BasisSwitch, DashboardBasisProvider } from "./dashboard-basis";
import { DashboardCurrencyProvider } from "./dashboard-currency";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { ROW_UNIT, useFitsWindow, useRowSpan, useWidePlus } from "./dashboard-layout";
import { SetupChecklist } from "./setup-checklist";
import { TodayCard } from "./today-card";
import { LedgerIntegrityAlert } from "./ledger-integrity-alert";
import { StorageIntegrityAlert } from "./storage-integrity-alert";
import { WIDGET_COMPONENTS, WIDGET_LABELS } from "./widget-registry";
import {
  AttentionCard,
  attentionHref,
  type AttentionRowAction,
} from "./attention-card";
import {
  useCapabilities,
  useCapability,
} from "../../../lib/capabilities-context";

/** `YYYY-MM-DD` in the browser's own calendar. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * S-09.12's per-role visible set. `capability`/`ownerOnly` on
 * `DASHBOARD_WIDGETS` are documentation/UX hints (never the real gate —
 * each widget's own data endpoint enforces that server-side), so this is
 * the same UX-only judgment call already made in Stage 3: Owner sees
 * everything, Staff sees everything except the Owner-only chart, Field
 * sees only the 4 widgets that have no financial capability attached.
 */
function visibleKeysForRole(
  role: string | null,
  can: (capability: Capability) => boolean,
  modules: ModuleSettings | null = null,
): DashboardWidgetKey[] {
  // US-SET-24: a switched-off module's widgets are gone.
  return visibleForRole(role, can).filter((key) => !ownedByOffModule(modules, "dashboardWidgets", key));
}

/** US-TEAM-31 (D-235): cards about a section are left out while it's closed for the member. */
const WIDGET_SECTION: Partial<Record<DashboardWidgetKey, Capability>> = {
  "pipeline-by-stage": "leads.open",
  "invoices-due": "invoices.open",
  "ready-to-bill": "jobs.open",
  "retention-held": "jobs.open",
  "jobs-in-progress": "jobs.open",
  "job-profitability": "jobs.open",
};

function visibleForRole(role: string | null, can: (capability: Capability) => boolean): DashboardWidgetKey[] {
  // US-DASH-18: Field get their own cards; nobody else sees them.
  if (role === "field")
    return DASHBOARD_WIDGETS.filter((w) => w.fieldOnly).map((w) => w.key);
  // US-DASH-20: a card the member has no capability for is left out, never shown locked or as an empty slot.
  return DASHBOARD_WIDGETS.filter(
    (w) =>
      !w.fieldOnly &&
      (role === "owner" || !w.ownerOnly) &&
      (w.capability === null || can(w.capability)) &&
      (role === "owner" || !WIDGET_SECTION[w.key] || can(WIDGET_SECTION[w.key]!)),
  ).map((w) => w.key);
}

/** US-DASH-29 (D-209): the one card two columns wide; it sits first, after the KPI row. */
const WIDE_KEYS = new Set<string>(["money-in-out"]);
/** From 1440 px the activity feed joins "Needs your attention" and "Today" in the side column. */
const SIDE_KEYS = new Set<string>(["activity-feed", "my-activity"]);

/**
 * US-DASH-29 — "Needs your attention", "Today" (and, from 1440 px, Recent
 * activity): a column on the right from 1440 px that stays in view while
 * it fits the window; a row at the top from 1280 px, the two cards the
 * same height; stacked below that.
 */
function SideColumn({ children }: { children: React.ReactNode }) {
  const { ref, fits } = useFitsWindow<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-testid="dashboard-side"
      data-sticky={fits ? "true" : "false"}
      className={cn("grid grid-cols-1 gap-4 xl:grid-cols-3 wide-plus:col-start-2 wide-plus:row-start-1 wide-plus:grid-cols-1 wide-plus:items-start", fits && "wide-plus:sticky wide-plus:top-6")}
    >
      {children}
    </div>
  );
}

/** One card in the grid, as tall as its content (US-DASH-29). */
function GridCell({ widgetKey, wide, children }: { widgetKey: string; wide: boolean; children: React.ReactNode }) {
  const { ref, style } = useRowSpan();
  return (
    <div className={cn("min-w-0", wide && "-order-1 lg:col-span-2")} style={style} data-widget={widgetKey}>
      <div ref={ref}>{children}</div>
    </div>
  );
}

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
export function DashboardShell({
  role,
  userName,
}: {
  role: string | null;
  userName: string | null;
}) {
  const [savedLayout, setSavedLayout] = useState<
    DashboardLayout | null | undefined
  >(undefined);
  const [editing, setEditing] = useState(false);
  // US-DASH-12 — what's waiting, and the header that counts it.
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [business, setBusiness] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  // US-DASH-18: a Field user's header counts their active jobs.
  const [fieldJobs, setFieldJobs] = useState<number | null>(null);
  // US-DASH-20: the Construction template shows retention and jobs in progress by default.
  const [template, setTemplate] = useState<string | null>(null);
  const [templateKnown, setTemplateKnown] = useState(false);
  const wide = useWidePlus();
  const { capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { modules } = useModules();
  const jobsOn = modules?.jobsField === true;
  const canSendReminder = useCapability("invoices.send_reminder");

  function loadAttention() {
    apiClient
      .get<AttentionItem[]>("/dashboard/attention")
      .then(setAttention)
      .catch(() => setAttention([]));
  }

  /**
   * US-DASH-13 (D-088, D-217) — each row's button. One overdue invoice:
   * the invoice, with its reminder email to check and send. Several: the
   * Invoices list, filtered to overdue with them ticked (sending asks
   * first). Without the capability: "Open".
   */
  function actionFor(item: AttentionItem, label: string): AttentionRowAction {
    if (item.kind === "invoices_overdue") {
      const first = item.items[0];
      if (!canSendReminder)
        return {
          label: "Open",
          href:
            item.count === 1 && first
              ? `/invoices/${first.id}`
              : "/invoices?status=overdue",
        };
      // One overdue invoice: open it with the reminder email ready to check and send.
      if (item.count === 1 && first) return { label, href: `/invoices/${first.id}?action=remind` };
    }
    return { label, href: attentionHref(item) };
  }

  useEffect(() => {
    apiClient
      .get<{ value: { template?: string } | null }>(
        "/org/settings/industry_template",
      )
      .then((res) => setTemplate(res.value?.template ?? null))
      .catch(() => {})
      .finally(() => setTemplateKnown(true));
  }, []);

  useEffect(() => {
    if (role !== "field" || !jobsOn) return;
    apiClient
      .get<unknown[]>("/jobs?assignedToMe=true&status=active")
      .then((rows) => setFieldJobs(rows.length))
      .catch(() => setFieldJobs(0));
  }, [role, jobsOn]);

  useEffect(() => {
    loadAttention();
    apiClient
      .get<{ value: { name?: string } | null }>(
        "/org/settings/business_profile",
      )
      .then((res) => setBusiness(res.value?.name?.trim() || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .get<{ layout: DashboardLayout | null }>("/users/me/dashboard-layout")
      .then((res) => setSavedLayout(res.layout))
      .catch(() => setSavedLayout(null));
  }, []);

  const visibleKeys = visibleKeysForRole(
    role,
    (c) => capabilities?.[c] ?? false,
    modules,
  );
  const merged = mergeDashboardLayout(
    savedLayout ?? null,
    visibleKeys,
    defaultHiddenWidgets(template),
  );

  async function persist(next: { widgetKey: string; hidden: boolean }[]) {
    const layout: DashboardLayout = next.map((entry, i) => ({
      widgetKey: entry.widgetKey,
      position: i,
      hidden: entry.hidden,
    }));
    setSavedLayout(layout);
    await apiClient.put("/users/me/dashboard-layout", layout);
  }

  function handleReorder(newOrder: string[]) {
    const byKey = new Map(merged.map((entry) => [entry.widgetKey, entry]));
    void persist(newOrder.map((key) => byKey.get(key)!));
  }

  function toggleHidden(widgetKey: string) {
    void persist(
      merged.map((entry) =>
        entry.widgetKey === widgetKey
          ? { ...entry, hidden: !entry.hidden }
          : entry,
      ),
    );
  }

  // Editing shows every widget (dimmed if hidden, so a user can find and
  // re-show one) — the normal view shows only what's actually visible.
  const displayed = editing ? merged : merged.filter((entry) => !entry.hidden);
  // US-DASH-27: the page's shape until the layout, rights and modules are known.
  const layoutKnown = savedLayout !== undefined && !capabilitiesLoading && modules !== null && templateKnown;
  // US-DASH-29: from 1440 px Recent activity sits in the side column (Edit layout keeps it in the grid, so it can be hidden).
  const sideKeys = wide && !editing ? displayed.filter((e) => SIDE_KEYS.has(e.widgetKey)).map((e) => e.widgetKey) : [];
  const gridKeys = displayed.map((e) => e.widgetKey).filter((key) => !sideKeys.includes(key));
  const columnsClass = role === "field" ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3 wide-plus:grid-cols-2";

  const firstName = userName?.trim().split(/\s+/)[0];
  const dateLine = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const subtitle =
    role === "field"
      ? [
          dateLine,
          attention && fieldJobs !== null
            ? fieldSummary(fieldJobs, attention.length)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          dateLine,
          business,
          attention ? attentionSummary(attention.length) : null,
        ]
          .filter(Boolean)
          .join(" · ");

  // US-DASH-26 — the switch is for members who see profit.
  const seesProfit =
    role === "owner" ||
    (role === "staff" &&
      (capabilities?.["reports.view_dashboard_summary"] ?? false));

  return (
    <DashboardBasisProvider>
      <DashboardCurrencyProvider>
      <div className="flex flex-col gap-6">
        <AppShellHeader
          className="mb-0"
          breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
          title={`${greetingFor(now.getHours())}${firstName ? `, ${firstName}` : ""}`}
          description={subtitle}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {seesProfit && <BasisSwitch />}
              <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
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
          }
        />
        {role === "owner" && <LedgerIntegrityAlert />}
        {role === "owner" && <StorageIntegrityAlert />}

        <p role="status" className="sr-only">
          {layoutKnown ? "" : "Loading dashboard"}
        </p>
        <div
          aria-busy={!layoutKnown}
          data-testid="dashboard-body"
          className="grid grid-cols-1 gap-4 wide-plus:grid-cols-[minmax(0,1fr)_340px] wide-plus:items-start"
        >
          {!layoutKnown ? (
            <DashboardSkeleton
              field={role === "field"}
              side={(cards) => <SideColumn>{cards}</SideColumn>}
            />
          ) : (
            <>
              <SideColumn>
                <AttentionCard
                  className="xl:col-span-2 wide-plus:col-span-1"
                  items={attention}
                  today={localToday()}
                  note={
                    role === "owner"
                      ? "Cleared items disappear automatically"
                      : "Only things you can act on"
                  }
                  actionFor={actionFor}
                  emptyText={
                    role === "field"
                      ? "Milestones due on your jobs and expenses sent back to you will show up here."
                      : undefined
                  }
                />
                <TodayCard />
                {sideKeys.map((key) => {
                  const Widget = WIDGET_COMPONENTS[key as DashboardWidgetKey];
                  return Widget ? <Widget key={key} /> : null;
                })}
              </SideColumn>

              <div className="@container flex min-w-0 flex-col gap-4 wide-plus:col-start-1 wide-plus:row-start-1">
                {role === "owner" && <SetupChecklist />}
                {role !== "field" && <KpiRow />}

                <ReorderableList
                  itemIds={displayed.map((e) => e.widgetKey)}
                  onReorder={handleReorder}
                  data-testid="dashboard-grid"
                  className={`grid grid-flow-row-dense grid-cols-1 gap-x-4 ${columnsClass}`}
                  style={{ gridAutoRows: `${ROW_UNIT}px` }}
                >
                  {/* DOM order is the layout order; CSS `order` puts the wide card first, and the dense grid drops each card into the shortest column. */}
                  {gridKeys.map((key) => {
                      const entry = displayed.find((e) => e.widgetKey === key)!;
                      const Widget =
                        WIDGET_COMPONENTS[entry.widgetKey as DashboardWidgetKey];
                      if (!Widget) return null;
                      const isWide = WIDE_KEYS.has(key);

                      if (!editing) {
                        return (
                          <GridCell key={key} widgetKey={key} wide={isWide}>
                            <Widget />
                          </GridCell>
                        );
                      }

                      return (
                        <EditableWidgetCard
                          key={key}
                          widgetKey={key}
                          wide={isWide}
                          hidden={entry.hidden}
                          onToggleHidden={() => toggleHidden(key)}
                        >
                          <Widget />
                        </EditableWidgetCard>
                      );
                    })}
                </ReorderableList>
              </div>
            </>
          )}
        </div>
      </div>
      </DashboardCurrencyProvider>
    </DashboardBasisProvider>
  );
}

function EditableWidgetCard({
  widgetKey,
  wide,
  hidden,
  onToggleHidden,
  children,
}: {
  widgetKey: string;
  wide: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  children: React.ReactNode;
}) {
  const { isOver } = useReorderableItemDragState(widgetKey);
  const { ref, style } = useRowSpan();

  return (
    <ReorderableItem id={widgetKey} className={cn("min-w-0", wide && "-order-1 lg:col-span-2")} style={style} data-widget={widgetKey}>
      <div ref={ref} className={`relative rounded-lg ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <div className={hidden ? "opacity-40" : ""}>{children}</div>
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 shadow-sm">
          <span className="text-[11px] font-medium text-on-surface-muted">
            {WIDGET_LABELS[widgetKey as DashboardWidgetKey] ?? widgetKey}
          </span>
          <HideToggle hidden={hidden} onToggle={onToggleHidden} />
          <DragHandle />
        </div>
      </div>
    </ReorderableItem>
  );
}
