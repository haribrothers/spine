"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleCheck, CircleMinus, Eye, LayoutGrid, Search, Sparkles } from "lucide-react";
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
  Badge,
  Button,
  Checkbox,
  Input,
  Spinner,
  Switch,
  cn,
} from "@spine/ui";
import { CAPABILITY_LABELS, type Capability } from "@spine/shared";
import { apiClient } from "../../../../../lib/api-client";
import type { MemberRow } from "../../../../../lib/members";
import { useModules } from "../../../../../lib/modules-context";
import type { TeamDetail, TeamPrivileges } from "../../../../../lib/teams";
import { applyToDraft, changeReason, draftChanges, matchesSearch, permissionGroups, sectionChangeLine, sectionChanges, sectionSwitches, sectionsOpened, waitsFor } from "../teams-state";

const ACCESS_WORDS = { work: " — can work here", view: " — view only", none: " — can't open" } as const;
const ACCESS_LABELS = { work: "Can work here", view: "View only", none: "Can't open" } as const;

const granted = (p: TeamPrivileges) => Object.entries(p).filter(([, on]) => on).map(([c]) => c);

/**
 * US-TEAM-28 (D-234) — `TeamPagePermissions`: switching a permission changes
 * a draft, never the Team — the switch is marked Changed, a bar sticks to
 * the bottom with Discard and Save changes, and Save asks first, listing
 * what turns on and off (with the ones that come with them, US-BANK-12) and
 * the sections members gain or lose. Groups say how many are on; search,
 * Show changed only and Expand all help find one; the side panel is what
 * members will open.
 *
 * US-TEAM-32 (D-235) — `TeamPageSections`: the Sections card above the groups
 * opens and closes sections in the same draft; a closed section's actions
 * wait for it ("Open Quotes first.").
 */
export function TeamPermissions({
  detail,
  members,
  onDirtyChange,
  onSaved,
}: {
  detail: TeamDetail;
  members: MemberRow[];
  onDirtyChange: (count: number) => void;
  onSaved: (count: number) => Promise<void>;
}) {
  const { modules } = useModules();
  const [draft, setDraft] = useState<TeamPrivileges>(detail.privileges);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(detail.privileges), [detail.privileges]);

  const changes = useMemo(() => draftChanges(detail.privileges, draft), [detail.privileges, draft]);
  useEffect(() => onDirtyChange(changes.length), [changes.length, onDirtyChange]);
  const changed = new Set(changes.map((c) => c.capability));
  const groups = useMemo(() => permissionGroups(modules), [modules]);
  const before = useMemo(() => sectionsOpened(granted(detail.privileges), modules), [detail.privileges, modules]);
  const after = useMemo(() => sectionsOpened(granted(draft), modules), [draft, modules]);
  const moved = useMemo(() => sectionChanges(before, after), [before, after]);
  const switches = useMemo(() => sectionSwitches(draft, modules), [draft, modules]);

  function change(list: { capability: Capability; granted: boolean }[]) {
    const next = applyToDraft(draft, list);
    // US-BANK-12: say which others came with a single switch, and why.
    if (list.length === 1) {
      const [{ capability, granted: on }] = list as [{ capability: Capability; granted: boolean }];
      const also = draftChanges(draft, next).filter((c) => c.capability !== capability);
      const reason = also.length ? changeReason(also[0]!.capability, also[0]!.granted, [{ capability, granted: on }]) : null;
      setNotice(also.length ? `${also.map((c) => `“${CAPABILITY_LABELS[c.capability].label}”`).join(" and ")} turned ${on ? "on" : "off"} too. ${reason ?? ""}`.trim() : null);
    } else setNotice(null);
    setDraft(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/org/teams/${detail.id}/privileges`, { privileges: changes });
      const count = changes.length;
      setConfirming(false);
      setNotice(null);
      await onSaved(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the permissions. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Keeps the confirm open while it saves; it closes once saved. */
  function confirmSave(e: React.MouseEvent) {
    e.preventDefault();
    save().catch(() => undefined);
  }

  const visible = groups
    .map((g) => ({ ...g, shown: g.capabilities.filter((c) => matchesSearch(c, q) && (!changedOnly || changed.has(c))) }))
    .filter((g) => g.shown.length > 0);
  const searching = Boolean(q.trim()) || changedOnly;
  const allOpen = groups.every((g) => expanded.has(g.label));

  return (
    <div className="flex flex-col gap-3 pb-20">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="info" data-testid="privilege-notice">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-80 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
          <Input type="search" aria-label="Search permissions" placeholder="Search permissions" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
          <Checkbox checked={changedOnly} onCheckedChange={(on) => setChangedOnly(on === true)} aria-label="Show changed only" />
          Show changed only
        </label>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.label)))}>
          {allOpen ? <ChevronsDownUp size={14} aria-hidden /> : <ChevronsUpDown size={14} aria-hidden />}
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface" aria-labelledby="team-sections-title" data-testid="team-sections">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-border bg-surface-sunken px-3.5 py-2.5">
          <h3 id="team-sections-title" className="text-[13.5px] font-semibold text-on-surface">Sections</h3>
          <p className="text-[12.5px] text-on-surface-muted">Closed sections leave members’ sidebar. Receivables, Payables, Banking and Reports open with their permissions below.</p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {switches.map((sw) => (
            <li key={sw.href} className={cn("-mb-px -mr-px flex items-center gap-3 border-b border-r border-border px-3.5 py-2.5 text-[13px]", changed.has(sw.capability) && "bg-info-bg/50")} data-section={sw.section} data-access={sw.access}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
                  {sw.section}
                  {changed.has(sw.capability) && <Badge className="bg-info-bg text-primary">Changed</Badge>}
                </span>
                <span className={cn("block text-[12px]", sw.access === "work" ? "text-paid" : "text-on-surface-muted")}>{ACCESS_LABELS[sw.access]}</span>
              </span>
              <Switch checked={sw.on} onCheckedChange={(checked) => change([{ capability: sw.capability, granted: checked }])} aria-label={`${sw.section} section`} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-border bg-surface" data-testid="permissions-list">
          {visible.length === 0 && <p className="px-4 py-6 text-[13px] text-on-surface-muted">{changedOnly ? "Nothing changed yet." : "No permission matches."}</p>}
          {visible.map((g) => {
            const on = g.capabilities.filter((c) => draft[c]).length;
            const was = g.capabilities.filter((c) => detail.privileges[c]).length;
            const open = searching || expanded.has(g.label);
            const all = on === g.capabilities.length;
            return (
              <div key={g.label} className="border-t border-border first:border-t-0">
                <div className="flex items-center gap-3 bg-surface-sunken px-3.5 py-2.5 text-[13.5px]">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.label)) next.delete(g.label);
                      else next.add(g.label);
                      return next;
                    })}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold text-on-surface"
                  >
                    {open ? <ChevronDown size={14} className="shrink-0" aria-hidden /> : <ChevronRight size={14} className="shrink-0" aria-hidden />}
                    <span className="truncate">{g.label}</span>
                  </button>
                  <span className="text-[12.5px] font-medium tabular-nums text-on-surface-muted" data-testid="group-count">
                    {on} of {g.capabilities.length}
                    {on !== was ? ` · was ${was}` : ""}
                  </span>
                  <Switch checked={all} onCheckedChange={(checked) => change(g.capabilities.map((capability) => ({ capability, granted: checked })))} aria-label={`Everything in ${g.label}`} />
                </div>
                {open &&
                  g.shown.map((c) => {
                    // US-TEAM-32: a closed section's actions wait for it.
                    const waiting = waitsFor(c, draft);
                    return (
                      <div key={c} className={cn("flex items-center gap-3 border-t border-border py-2.5 pl-9 pr-3.5 text-[13px]", changed.has(c) && "bg-info-bg/50")} data-waiting={waiting ? "" : undefined}>
                        <div className="min-w-0 flex-1">
                          <p className={cn("flex flex-wrap items-center gap-2 font-medium", waiting ? "text-on-surface-muted" : "text-on-surface")}>
                            {CAPABILITY_LABELS[c].label}
                            {changed.has(c) && <Badge className="bg-info-bg text-primary">Changed</Badge>}
                          </p>
                          <p className="text-[12.5px] text-on-surface-muted">{waiting ?? CAPABILITY_LABELS[c].description}</p>
                        </div>
                        <Switch checked={draft[c] ?? false} disabled={waiting !== null} onCheckedChange={(checked) => change([{ capability: c, granted: checked }])} aria-label={CAPABILITY_LABELS[c].label} />
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        <aside className="rounded-lg border border-border bg-surface px-4 py-3.5" data-testid="members-will-open">
          <h3 className="text-[13.5px] font-semibold text-on-surface">What members will open</h3>
          <p className="mb-2.5 text-[12.5px] text-on-surface-muted">Their sidebar with these permissions — before any other Team adds to it.</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {after.all.map((s) => {
              const change = moved.find((m) => m.href === s.href);
              const Icon = s.access === "work" ? CircleCheck : s.access === "view" ? Eye : CircleMinus;
              return (
                <li key={s.href} className={cn("flex items-center gap-2", s.access === "work" ? "text-on-surface" : "text-on-surface-muted")} data-access={s.access}>
                  <Icon size={15} aria-hidden className={s.access === "work" ? "text-paid" : undefined} />
                  <span className="min-w-0 flex-1">
                    {s.label}
                    {s.access === "view" && <span className="text-[12px]"> · view only</span>}
                  </span>
                  <span className="sr-only">{ACCESS_WORDS[s.access]}</span>
                  {change && <Badge className={change.up ? "bg-paid-bg text-paid" : "bg-overdue-bg text-overdue"}>{change.up ? "Added" : "Lost"}</Badge>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-on-surface-muted" aria-hidden>
            <span className="flex items-center gap-1"><CircleCheck size={13} className="text-paid" />Can work here</span>
            <span className="flex items-center gap-1"><Eye size={13} />View only</span>
            <span className="flex items-center gap-1"><CircleMinus size={13} />Can&apos;t open</span>
          </p>
          {modules?.ai && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-info-bg p-2.5 text-[12.5px] text-on-surface" data-testid="ai-not-a-section">
              <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              AI isn&apos;t a section. With Use AI features, members see AI on the bills, expenses, quotes, emails and reconciliations they can already work on.
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-on-surface-muted">{members.length ? `Applies to ${members.length === 1 ? "1 person" : `${members.length} people`} at their next request.` : "No one is on this Team yet."}</p>
        </aside>
      </div>

      {changes.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-on-surface py-2.5 pl-5 pr-3 text-[13.5px] font-medium text-surface shadow-lg" data-testid="permissions-bar" role="region" aria-label="Unsaved changes">
          {changes.length === 1 ? "1 change" : `${changes.length} changes`}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(detail.privileges);
              setNotice(null);
            }}
          >
            Discard
          </Button>
          <Button size="sm" onClick={() => setConfirming(true)}>
            Save changes
          </Button>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Save {changes.length === 1 ? "1 change" : `${changes.length} changes`} to {detail.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {members.length ? `${members.map((m) => m.name).join(", ")} get${members.length === 1 ? "s" : ""} this at their next request.` : "No one is on this Team yet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-auto text-[13px] text-on-surface" data-testid="save-permissions-list">
            {changes.map((c) => {
              const reason = changeReason(c.capability, c.granted, changes);
              return (
                <li key={c.capability} className="flex items-start gap-2">
                  {c.granted ? <CircleCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-paid" /> : <CircleMinus size={15} aria-hidden className="mt-0.5 shrink-0 text-overdue" />}
                  <span>
                    {c.granted ? "Turn on" : "Turn off"} <b className="font-semibold">{CAPABILITY_LABELS[c.capability].label}</b>
                    {reason && <span className="block text-[12px] text-on-surface-muted">{reason}</span>}
                  </span>
                </li>
              );
            })}
            {moved.map((s) => (
              <li key={`s${s.href}`} className="flex items-start gap-2">
                <LayoutGrid size={15} aria-hidden className="mt-0.5 shrink-0 text-on-surface-muted" />
                <span>
                  {sectionChangeLine(s.was, s.access)} <b className="font-semibold">{s.label}</b>
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>
              {saving ? <Spinner size="sm" /> : null}
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
