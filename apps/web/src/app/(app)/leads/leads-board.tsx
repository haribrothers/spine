"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { replaceQuery } from "../../../lib/replace-query";
import { useFillHeight } from "../../../lib/use-fill-height";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  KanbanBoard,
  KanbanColumn,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { LOST_REASON_LABELS, type LeadStage, type LostReason } from "@spine/shared";
import { ArrowUpDown, ChevronsRightLeft, Plus, RefreshCw, Search, SlidersHorizontal, Target } from "lucide-react";
import { type Contact, type Lead } from "../contacts/types";
import { STAGE_DOT_CLASS, useLeadStages } from "../contacts/use-lead-stages";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { apiClient } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { useCapability } from "../../../lib/capabilities-context";
import type { MemberRow } from "../../../lib/members";
import { formatMoney } from "../../../lib/money";
import { LeadCard } from "./lead-card";
import { LeadDrawer } from "./lead-drawer";
import { LeadLostDialog, LeadWonDialog } from "./lead-closed-dialogs";
import { useToast } from "../../../components/toast-host";
import { PipelineSummaryStrip } from "./pipeline-summary";
import {
  CLOSED_WINDOW_DAYS,
  SORTERS,
  SORT_LABELS,
  byClosedNewest,
  closedWithin,
  hasPipelineFilters,
  matchesPipeline,
  parsePipelineState,
  pipelineQuery,
  pipelineSummary,
  totalsByCurrency,
  type PipelineState,
  type SortKey,
} from "./pipeline-state";

const BOARD_VIEW_STORAGE_KEY = "spine.leads.view-settings";
const ALL = "__all__";

interface ViewSettings {
  showValue: boolean;
  showSource: boolean;
}

const DEFAULT_VIEW_SETTINGS: ViewSettings = { showValue: true, showSource: true };

/** Open stages share the width down to this; past it, the board scrolls sideways (US-CRM-24: six open stages fit at 1280 px). */
const OPEN_COLUMN_MIN_WIDTH = 128;
const CLOSED_COLUMN_MIN_WIDTH = 200;

/** The board runs from its top to the bottom of the window (every column full height), never shorter than this. */
const BOARD_MIN_HEIGHT = 420;

function Totals({ leads, empty }: { leads: Lead[]; empty?: string }) {
  const totals = totalsByCurrency(leads);
  if (totals.length === 0) return empty ? <>{empty}</> : null;
  return (
    <span className="flex flex-col">
      {totals.map(([currency, total]) => (
        <span key={currency}>{formatMoney(total, currency)}</span>
      ))}
    </span>
  );
}

/**
 * S-01.5, rebuilt by US-CRM-24 to 28 (D-211) — the org-wide pipeline.
 * Open stages share the width and run full height; Won and Lost are slim
 * columns with the last 30 days that open on press. A summary strip sits
 * above; cards show the owner, days in stage, the next follow-up and a
 * nudge for cold leads, and have a "⋯" menu to move them without
 * dragging. Moving to Lost asks why, moving to Won offers a quote. A lead
 * opens in a drawer. Filters, search and sort live in the address
 * (D-210), and the board refreshes on request or when the tab comes back.
 * Everything is worked out from the leads already loaded — `GET /leads`
 * returns every lead in the organisation.
 */
export function LeadsBoard() {
  const router = useRouter();
  const showToast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const me = session?.user?.id ?? null;
  const canCreate = useCapability("leads.edit_own");
  const canQuote = useCapability("quotes.edit_own");
  const canMoveOwn = useCapability("leads.edit_own");
  const canMoveOthers = useCapability("leads.edit_others");
  const canDeleteOwn = useCapability("leads.delete_own");
  const canDeleteOthers = useCapability("leads.delete_others");

  const [state, setState] = useState<PipelineState>(() => parsePipelineState(new URLSearchParams(searchParams.toString())));
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [createStage, setCreateStage] = useState<string | undefined>(undefined);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const lostToasted = useRef(false);
  const [wonLead, setWonLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const loading = useRef(false);
  // US-QUO-33: `?lead=<id>` (a quote's Related panel) opens that lead in the drawer.
  const leadParam = searchParams.get("lead");
  useEffect(() => {
    if (!leadParam) return;
    setDrawerLeadId(leadParam);
    setDrawerOpen(true);
  }, [leadParam]);
  const { stages, error: stagesError, reload: reloadStages } = useLeadStages();
  const board = useFillHeight({ minHeight: BOARD_MIN_HEIGHT });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY);
      if (stored) setViewSettings({ ...DEFAULT_VIEW_SETTINGS, ...JSON.parse(stored) });
    } catch {
      // ignore a missing or malformed stored value, keep defaults
    }
  }, []);

  function updateViewSetting(key: keyof ViewSettings, value: boolean) {
    setViewSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable; the setting still applies for this visit
      }
      return next;
    });
  }

  /** Sets part of the board state and writes it to the address (no history entry per keystroke). */
  function update(patch: Partial<PipelineState>) {
    const next = { ...state, ...patch };
    setState(next);
    const query = pipelineQuery(next);
    replaceQuery(pathname, query);
  }

  /** The first load shows the placeholder; a refresh keeps the board on screen. */
  const load = useCallback(
    async (mode: "first" | "refresh") => {
      if (loading.current) return;
      loading.current = true;
      if (mode === "refresh") setRefreshing(true);
      try {
        const [leadRows, contactRows] = await Promise.all([
          apiClient.get<Lead[]>("/leads"),
          apiClient.get<Contact[]>("/contacts?includeArchived=true").catch(() => [] as Contact[]),
        ]);
        setLeads(leadRows);
        setContacts(contactRows);
        setRefreshFailed(false);
        setUpdatedAt(Date.now());
        setNow(Date.now());
        if (mode === "refresh") {
          reloadStages();
          setAnnouncement("Pipeline updated");
        }
      } catch (err) {
        if (mode === "first") setError(err instanceof Error ? err.message : "Could not load the pipeline.");
        else setRefreshFailed(true);
      } finally {
        loading.current = false;
        setRefreshing(false);
      }
    },
    [reloadStages],
  );

  useEffect(() => {
    void load("first");
    apiClient
      .get<MemberRow[]>("/org/members")
      .then(setMembers)
      .catch(() => setMembers([]));
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, [load]);

  // US-CRM-28: back on the tab after 30 s or more, refresh quietly.
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  // "Updated 2 min ago" and days in stage move on by themselves.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const memberNames = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);
  const ownerName = (lead: Lead) => (lead.ownerUserId ? (memberNames.get(lead.ownerUserId) ?? null) : null);
  const contactName = (lead: Lead) => contactsById.get(lead.contactId)?.name ?? null;

  const visible = useMemo(
    () => (leads ?? []).filter((lead) => matchesPipeline(lead, contactsById.get(lead.contactId)?.name ?? "", state, me, now)),
    [leads, contactsById, state, me, now],
  );
  const summary = useMemo(() => pipelineSummary(leads ?? [], now), [leads, now]);

  const stageOptions = useMemo(() => (stages ?? []).map((s) => ({ value: s.id, label: s.name })), [stages]);
  const sources = useMemo(() => [...new Set((leads ?? []).flatMap((l) => (l.source ? [l.source] : [])))].sort((a, b) => a.localeCompare(b)), [leads]);
  const activeMembers = useMemo(() => members.filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name)), [members]);

  // Measure again once the toolbar and summary are on screen.
  const ready = leads !== null && stages !== null;
  const measureBoard = board.measure;
  useLayoutEffect(() => {
    if (ready) measureBoard();
  }, [ready, measureBoard]);

  function canEdit(lead: Lead) {
    return lead.createdByUserId !== null && lead.createdByUserId === me ? canMoveOwn : canMoveOthers;
  }
  function canDelete(lead: Lead) {
    return lead.createdByUserId !== null && lead.createdByUserId === me ? canDeleteOwn : canDeleteOthers;
  }

  function replaceLead(lead: Lead) {
    setLeads((prev) => {
      if (!prev) return [lead];
      return prev.some((l) => l.id === lead.id) ? prev.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...prev];
    });
  }

  /** After a lead lands in a closed stage: ask why it was lost, or offer a quote for a win. */
  function afterMove(lead: Lead) {
    if (lead.stageKind === "lost" && lead.lostReason) toastLost(lead, lead.lostReason);
    else if (lead.stageKind === "lost") setLostLead(lead);
    else if (lead.stageKind === "won" && canQuote) setWonLead(lead);
  }

  async function moveLead(lead: Lead, stage: LeadStage) {
    if (lead.stageId === stage.id) return;
    if (!canEdit(lead)) {
      setAnnouncement("You can't move this lead.");
      return;
    }
    const moved: Lead = { ...lead, stageId: stage.id, stageName: stage.name, stageKind: stage.kind, stageChangedAt: new Date().toISOString(), lostReason: null, lostNote: null };
    replaceLead(moved);
    setAnnouncement(`Moved to ${stage.name}`);
    try {
      const saved = await apiClient.put<Lead>(`/leads/${lead.id}`, { stageId: stage.id });
      replaceLead(saved);
      setUpdatedAt(Date.now());
      afterMove(saved);
    } catch {
      replaceLead(lead);
      setAnnouncement(`Couldn't move ${lead.title ?? "the lead"}. Try again.`);
    }
  }

  /** US-OPS-38: a lead marked lost says so — with its reason, or where to add one. */
  function toastLost(lead: Lead, reason: LostReason | null) {
    const title = lead.title ?? "The lead";
    showToast("Lead marked lost", reason ? `${title} — reason: ${LOST_REASON_LABELS[reason].toLowerCase()}.` : `${title} is in ${lead.stageName}; add why from the lead when you know.`);
  }

  async function saveLostReason(reason: LostReason | null, note: string) {
    if (!lostLead) return;
    const saved = await apiClient.put<Lead>(`/leads/${lostLead.id}`, { lostReason: reason, lostNote: note || null });
    replaceLead(saved);
    lostToasted.current = true;
    toastLost(saved, reason);
  }

  /** Skip (or Save, which has already said so) closes the reason dialog. */
  function closeLostDialog() {
    if (lostLead && !lostToasted.current) toastLost(lostLead, null);
    lostToasted.current = false;
    setLostLead(null);
  }

  function createQuote(lead: Lead) {
    router.push(`/quotes/new?leadId=${lead.id}`);
  }

  function openCreate(stageId?: string) {
    setDrawerLeadId(null);
    setCreateStage(stageId);
    setDrawerOpen(true);
  }

  function openLead(lead: Lead) {
    setMenuFor(null);
    setDrawerLeadId(lead.id);
    setDrawerOpen(true);
  }

  async function confirmDelete() {
    if (!deleteLead) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/leads/${deleteLead.id}`);
      setLeads((prev) => prev?.filter((l) => l.id !== deleteLead.id) ?? prev);
      setAnnouncement(`Deleted ${deleteLead.title ?? "the lead"}`);
      showToast("Lead deleted", `“${deleteLead.title ?? "The lead"}” is gone from the pipeline.`);
      if (drawerLeadId === deleteLead.id) setDrawerOpen(false);
      setDeleteLead(null);
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpanded(stageId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  if (error || stagesError) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error ?? stagesError}</AlertDescription>
      </Alert>
    );
  }

  if (!leads || !stages) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the pipeline">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[84px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-md" />
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 flex-1 rounded-lg" />
          ))}
          <Skeleton className="h-96 w-14 rounded-lg" />
          <Skeleton className="h-96 w-14 rounded-lg" />
        </div>
      </div>
    );
  }

  const drawerLead = drawerLeadId ? (leads.find((l) => l.id === drawerLeadId) ?? null) : null;
  const filtered = hasPipelineFilters(state);
  const shownStages = state.stages.length ? stages.filter((s) => state.stages.includes(s.id)) : stages;
  const ownerValue = state.owner || ALL;

  return (
    <div className="flex flex-col gap-4">
      <PipelineSummaryStrip summary={summary} currency={currency} overdueActive={state.overdue} onOverdueToggle={() => update({ overdue: !state.overdue })} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted" />
            <Input
              value={state.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search leads or contacts…"
              aria-label="Search leads or contacts"
              className="w-48 pl-8"
            />
          </div>
          <MultiSelect options={stageOptions} value={state.stages} onValueChange={(next) => update({ stages: next })} placeholder="All stages" aria-label="Filter by stage" className="w-32" />
          <Select value={ownerValue} onValueChange={(v) => update({ owner: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by owner" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All owners</SelectItem>
              <SelectItem value="me">My leads</SelectItem>
              {activeMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name}
                </SelectItem>
              ))}
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={state.source || ALL} onValueChange={(v) => update({ source: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by source" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
              {state.source && !sources.includes(state.source) && <SelectItem value={state.source}>{state.source}</SelectItem>}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <ArrowUpDown size={14} aria-hidden />
                {SORT_LABELS[state.sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={state.sort} onValueChange={(v) => update({ sort: v as SortKey })}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <SlidersHorizontal size={14} aria-hidden />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Card details</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <label className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-on-surface">
                <input type="checkbox" checked={viewSettings.showValue} onChange={(e) => updateViewSetting("showValue", e.target.checked)} />
                Show value
              </label>
              <label className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-on-surface">
                <input type="checkbox" checked={viewSettings.showSource} onChange={(e) => updateViewSetting("showSource", e.target.checked)} />
                Show source
              </label>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {updatedAt !== null && (
            <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="pipeline-updated">
              {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Refresh pipeline" aria-busy={refreshing} disabled={refreshing} onClick={() => void load("refresh")}>
                <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh pipeline</TooltipContent>
          </Tooltip>
          {canCreate && (
            <Button onClick={() => openCreate()}>
              <Plus size={14} aria-hidden />
              Add lead
            </Button>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {refreshFailed && (
        <Alert variant="critical">
          <AlertDescription>Couldn&apos;t refresh the pipeline. Check your connection and try again.</AlertDescription>
        </Alert>
      )}

      {leads.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Target />}
            title="No leads yet"
            description="Add your first lead to start tracking your pipeline."
            action={canCreate ? <Button onClick={() => openCreate()}>Add lead</Button> : undefined}
          />
        </div>
      ) : filtered && visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Target />}
            title="No leads match these filters"
            description="Try a different search, or clear the filters to see the whole pipeline."
            action={
              <Button variant="secondary" onClick={() => update({ q: "", stages: [], owner: "", source: "", overdue: false })}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div ref={board.ref} style={board.height ? { height: board.height } : undefined} className="min-h-[420px]" data-testid="pipeline-board">
          <KanbanBoard>
            {shownStages.map((stage) => {
              const closed = stage.kind !== "open";
              // A closed stage chosen in the stage filter shows all its leads; otherwise the last 30 days.
              const stageLeads = visible.filter((l) => l.stageId === stage.id && (!closed || state.stages.length > 0 || closedWithin(l, CLOSED_WINDOW_DAYS, now)));
              stageLeads.sort(closed ? byClosedNewest : SORTERS[state.sort]);
              const dot = <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_CLASS[stage.color])} />;
              const onDrop = (cardId: string) => {
                const lead = leads.find((l) => l.id === cardId);
                if (lead) void moveLead(lead, stage);
              };
              const recent = closed && state.stages.length === 0;

              if (recent && !expanded.has(stage.id)) {
                const totals = totalsByCurrency(stageLeads);
                const totalText = totals.map(([c, t]) => formatMoney(t, c)).join(" + ");
                return (
                  <KanbanColumn
                    key={stage.id}
                    collapsed
                    title={stage.name}
                    accent={dot}
                    meta={stageLeads.length}
                    subtitle={`${totalText || formatMoney(0n, currency)} · ${CLOSED_WINDOW_DAYS} days`}
                    expandLabel={`Show ${stage.name}: ${stageLeads.length} ${stageLeads.length === 1 ? "lead" : "leads"} in the last ${CLOSED_WINDOW_DAYS} days${totalText ? `, ${totalText}` : ""}`}
                    onExpand={() => toggleExpanded(stage.id)}
                    onDrop={onDrop}
                    data-stage={stage.name}
                  />
                );
              }

              return (
                <KanbanColumn
                  key={stage.id}
                  title={recent ? `${stage.name} · last ${CLOSED_WINDOW_DAYS} days` : stage.name}
                  accent={dot}
                  meta={stageLeads.length}
                  subtitle={<Totals leads={stageLeads} empty={formatMoney(0n, currency)} />}
                  minWidth={closed ? CLOSED_COLUMN_MIN_WIDTH : OPEN_COLUMN_MIN_WIDTH}
                  headerAction={
                    recent ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-on-surface-muted" aria-label={`Hide ${stage.name}`} onClick={() => toggleExpanded(stage.id)}>
                        <ChevronsRightLeft size={15} aria-hidden />
                      </Button>
                    ) : undefined
                  }
                  className={stage.kind === "lost" ? "bg-surface-sunken" : undefined}
                  onDrop={onDrop}
                  data-stage={stage.name}
                >
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      contactName={contactName(lead)}
                      ownerName={ownerName(lead)}
                      stages={stages}
                      now={now}
                      showValue={viewSettings.showValue}
                      showSource={viewSettings.showSource}
                      canMove={canEdit(lead)}
                      canDelete={canDelete(lead)}
                      menuOpen={menuFor === lead.id}
                      onMenuOpenChange={(open) => setMenuFor(open ? lead.id : null)}
                      onOpen={() => openLead(lead)}
                      onMove={(target) => void moveLead(lead, target)}
                      onDelete={() => setDeleteLead(lead)}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="rounded-md border border-dashed border-border-strong px-2 py-3.5 text-center text-[12.5px] text-on-surface-muted">
                      {recent ? `Nothing ${stage.kind === "won" ? "won" : "lost"} in the last ${CLOSED_WINDOW_DAYS} days` : "No leads in this stage"}
                    </p>
                  )}
                  {recent && stageLeads.length > 0 && (
                    <p className="px-1 py-1.5 text-[12px] text-on-surface-muted">Older {stage.kind === "won" ? "won" : "lost"} leads: choose {stage.name} in the stage filter.</p>
                  )}
                  {canCreate && stage.kind === "open" && (
                    <Button variant="ghost" size="sm" className="justify-start text-on-surface-muted" onClick={() => openCreate(stage.id)}>
                      <Plus size={14} aria-hidden />
                      Add lead
                    </Button>
                  )}
                </KanbanColumn>
              );
            })}
          </KanbanBoard>
        </div>
      )}

      <LeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lead={drawerLead}
        contacts={contacts}
        leads={leads}
        stages={stages}
        members={members}
        defaultStageId={createStage}
        onSaved={(saved, previousStageId) => {
          replaceLead(saved);
          setUpdatedAt(Date.now());
          if (previousStageId !== saved.stageId) afterMove(saved);
        }}
        onDeleteRequest={setDeleteLead}
        onCreateQuote={createQuote}
      />

      <LeadLostDialog lead={lostLead} contactName={lostLead ? contactName(lostLead) : null} onSave={saveLostReason} onClose={closeLostDialog} />
      <LeadWonDialog
        lead={wonLead}
        contactName={wonLead ? contactName(wonLead) : null}
        ownerName={wonLead ? ownerName(wonLead) : null}
        onCreateQuote={(lead) => {
          setWonLead(null);
          createQuote(lead);
        }}
        onClose={() => setWonLead(null)}
      />

      <AlertDialog open={deleteLead !== null} onOpenChange={(open) => !open && setDeleteLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone. The lead&apos;s follow-ups and activities go with it; the contact and any quotes stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? <Spinner size="sm" /> : "Delete lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
