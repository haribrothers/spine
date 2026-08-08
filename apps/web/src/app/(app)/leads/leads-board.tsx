"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
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
  KanbanCard,
  KanbanColumn,
  MultiSelect,
  Skeleton,
} from "@spine/ui";
import { ArrowUpDown, Plus, Search, SlidersHorizontal, Target } from "lucide-react";
import { LeadDialog } from "./lead-dialog";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type Contact, type Lead, type LeadStage } from "../contacts/types";
import { apiClient } from "../../../lib/api-client";

type SortKey = "value-desc" | "value-asc" | "newest" | "oldest" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  "value-desc": "Value: high to low",
  "value-asc": "Value: low to high",
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title (A–Z)",
};

const SORTERS: Record<SortKey, (a: Lead, b: Lead) => number> = {
  "value-desc": (a, b) => Number(b.valueAmount) - Number(a.valueAmount),
  "value-asc": (a, b) => Number(a.valueAmount) - Number(b.valueAmount),
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  title: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
};

const STAGE_OPTIONS = LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] }));

const BOARD_VIEW_STORAGE_KEY = "spine.leads.view-settings";

interface ViewSettings {
  showValue: boolean;
  showSource: boolean;
}

const DEFAULT_VIEW_SETTINGS: ViewSettings = { showValue: true, showSource: true };

function formatMoney(amount: string | number | bigint, currency: string) {
  return (Number(amount) / 100).toLocaleString(undefined, { style: "currency", currency });
}

/**
 * S-01.5 — the org-wide leads pipeline board. Composes the generic
 * @spine/ui KanbanBoard/KanbanColumn/KanbanCard primitives (see that
 * component's own docs page for the reusable half of this) with
 * leads-specific search/filter/sort/view-settings and the create/edit
 * dialog. Grouping and filtering are client-side, mirroring
 * ContactsExplorer's "load once, derive in memory" pattern — `GET /leads`
 * with no stage filter already returns every lead in the org, and lead
 * volumes at this app's target scale don't justify a server-side
 * aggregation endpoint for a handful of columns.
 */
export function LeadsBoard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [createStage, setCreateStage] = useState<LeadStage | undefined>(undefined);

  useEffect(() => {
    const stored = window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY);
    if (stored) {
      try {
        setViewSettings({ ...DEFAULT_VIEW_SETTINGS, ...JSON.parse(stored) });
      } catch {
        // ignore malformed stored value, keep defaults
      }
    }
  }, []);

  function updateViewSetting(key: keyof ViewSettings, value: boolean) {
    setViewSettings((prev) => {
      const next = { ...prev, [key]: value };
      window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const loadLeads = useCallback(() => {
    apiClient
      .get<Lead[]>("/leads")
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the pipeline."));
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    apiClient
      .get<Contact[]>("/contacts?includeArchived=true")
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filteredLeads = useMemo(() => {
    if (!leads) return null;
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter.length > 0 && !stageFilter.includes(lead.stage)) return false;
      if (!query) return true;
      const contact = contactsById.get(lead.contactId);
      return (lead.title ?? "").toLowerCase().includes(query) || (contact?.name ?? "").toLowerCase().includes(query);
    });
  }, [leads, search, stageFilter, contactsById]);

  const columns = useMemo(() => {
    const grouped = new Map<LeadStage, Lead[]>(LEAD_STAGES.map((s) => [s, []]));
    for (const lead of filteredLeads ?? []) {
      grouped.get(lead.stage)?.push(lead);
    }
    const sorter = SORTERS[sort];
    for (const rows of grouped.values()) rows.sort(sorter);
    return grouped;
  }, [filteredLeads, sort]);

  async function moveLead(lead: Lead, stage: LeadStage) {
    if (lead.stage === stage) return;
    setLeads((prev) => prev?.map((l) => (l.id === lead.id ? { ...l, stage } : l)) ?? prev);
    try {
      await apiClient.put(`/leads/${lead.id}`, { stage });
    } catch {
      loadLeads();
    }
  }

  function openCreateDialog(stage?: LeadStage) {
    setEditingLead(null);
    setCreateStage(stage);
    setDialogOpen(true);
  }

  function openEditDialog(lead: Lead) {
    setEditingLead(lead);
    setDialogOpen(true);
  }

  function handleSaved(lead: Lead) {
    setLeads((prev) => {
      if (!prev) return [lead];
      const exists = prev.some((l) => l.id === lead.id);
      return exists ? prev.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...prev];
    });
  }

  function handleDeleted(leadId: string) {
    setLeads((prev) => prev?.filter((l) => l.id !== leadId) ?? prev);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!leads) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {LEAD_STAGES.map((s) => (
          <Skeleton key={s} className="h-96 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads or contacts…"
              className="w-56 pl-8"
            />
          </div>
          <MultiSelect
            options={STAGE_OPTIONS}
            value={stageFilter}
            onValueChange={setStageFilter}
            placeholder="All stages"
            className="w-40"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <ArrowUpDown size={14} />
                {SORT_LABELS[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
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
                <SlidersHorizontal size={14} />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Card details</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <label className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-on-surface">
                <input
                  type="checkbox"
                  checked={viewSettings.showValue}
                  onChange={(e) => updateViewSetting("showValue", e.target.checked)}
                />
                Show value
              </label>
              <label className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-on-surface">
                <input
                  type="checkbox"
                  checked={viewSettings.showSource}
                  onChange={(e) => updateViewSetting("showSource", e.target.checked)}
                />
                Show source
              </label>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button onClick={() => openCreateDialog()}>
          <Plus size={14} />
          Add lead
        </Button>
      </div>

      {filteredLeads && filteredLeads.length === 0 && leads.length === 0 ? (
        <div className="rounded-lg border border-border">
          <EmptyState
            icon={<Target />}
            title="No leads yet"
            description="Add your first lead to start tracking your pipeline."
            action={<Button onClick={() => openCreateDialog()}>Add lead</Button>}
          />
        </div>
      ) : filteredLeads && filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-border">
          <EmptyState
            icon={<Target />}
            title="No leads match these filters"
            description="Try adjusting your search or stage filter."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStageFilter([]);
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <KanbanBoard className="min-h-0 flex-1">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = columns.get(stage) ?? [];
            const totalsByCurrency = new Map<string, number>();
            for (const lead of stageLeads) {
              totalsByCurrency.set(lead.valueCurrency, (totalsByCurrency.get(lead.valueCurrency) ?? 0) + Number(lead.valueAmount));
            }
            const isLost = stage === "lost";

            return (
              <KanbanColumn
                key={stage}
                title={LEAD_STAGE_LABELS[stage]}
                meta={stageLeads.length}
                className={isLost ? "border-overdue bg-overdue-bg" : undefined}
                subtitle={
                  totalsByCurrency.size > 0 ? (
                    <div className="flex flex-col">
                      {[...totalsByCurrency.entries()].map(([currency, total]) => (
                        <span key={currency}>{formatMoney(total, currency)}</span>
                      ))}
                    </div>
                  ) : undefined
                }
                onDrop={(cardId) => {
                  const lead = leads.find((l) => l.id === cardId);
                  if (lead) moveLead(lead, stage);
                }}
              >
                {stageLeads.map((lead) => {
                  const contact = contactsById.get(lead.contactId);
                  return (
                    <KanbanCard key={lead.id} id={lead.id} onClick={() => openEditDialog(lead)}>
                      <span className="font-medium text-on-surface">{lead.title ?? contact?.name ?? "Untitled lead"}</span>
                      {contact && <span className="text-on-surface-muted">{contact.name}</span>}
                      {(viewSettings.showValue || (viewSettings.showSource && lead.source)) && (
                        <div className="flex items-center justify-between pt-1">
                          {viewSettings.showValue ? (
                            <span className="text-on-surface-muted">{formatMoney(lead.valueAmount, lead.valueCurrency)}</span>
                          ) : (
                            <span />
                          )}
                          {viewSettings.showSource && lead.source && <Badge>{lead.source}</Badge>}
                        </div>
                      )}
                    </KanbanCard>
                  );
                })}
                <Button variant="ghost" size="sm" className="justify-start text-on-surface-muted" onClick={() => openCreateDialog(stage)}>
                  <Plus size={14} />
                  Add lead
                </Button>
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
      )}

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        contacts={contacts}
        leads={leads}
        defaultStage={createStage}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
