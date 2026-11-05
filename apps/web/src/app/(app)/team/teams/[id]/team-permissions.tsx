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
import { t, useT } from "../../../../../lib/i18n";
import type { MemberRow } from "../../../../../lib/members";
import { useModules } from "../../../../../lib/modules-context";
import type { TeamDetail, TeamPrivileges } from "../../../../../lib/teams";
import { applyToDraft, changeReason, draftChanges, matchesSearch, permissionGroups, sectionChangeLine, sectionChanges, sectionSwitches, sectionsOpened, waitsFor } from "../teams-state";

const ACCESS_WORDS = { work: t("team.access.workWords"), view: t("team.access.viewWords"), none: t("team.access.noneWords") } as const;
const ACCESS_LABELS = { work: t("team.access.canWorkHere"), view: t("team.access.viewOnly"), none: t("team.access.cantOpen") } as const;

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
  const t = useT();
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
      setNotice(also.length ? t(on ? "team.permissions.alsoOn" : "team.permissions.alsoOff", { names: also.map((c) => t("team.permissions.quoted", { label: CAPABILITY_LABELS[c.capability].label })).join(t("team.common.andSeparator")), reason: reason ?? "" }).trim() : null);
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
      setError(err instanceof Error ? err.message : t("team.permissions.saveFailed"));
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
          <Input type="search" aria-label={t("team.permissions.search")} placeholder={t("team.permissions.search")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
          <Checkbox checked={changedOnly} onCheckedChange={(on) => setChangedOnly(on === true)} aria-label={t("team.permissions.showChangedOnly")} />
          {t("team.permissions.showChangedOnly")}
        </label>
        <span className="flex-1" />
        <Button variant="secondary" size="sm" onClick={() => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.label)))}>
          {allOpen ? <ChevronsDownUp size={14} aria-hidden /> : <ChevronsUpDown size={14} aria-hidden />}
          {allOpen ? t("team.permissions.collapseAll") : t("team.permissions.expandAll")}
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-surface" aria-labelledby="team-sections-title" data-testid="team-sections">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-border bg-surface-sunken px-3.5 py-2.5">
          <h3 id="team-sections-title" className="text-[13.5px] font-semibold text-on-surface">{t("team.access.sections")}</h3>
          <p className="text-[12.5px] text-on-surface-muted">{t("team.permissions.sectionsNote")}</p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {switches.map((sw) => (
            <li key={sw.href} className={cn("-mb-px -mr-px flex items-center gap-3 border-b border-r border-border px-3.5 py-2.5 text-[13px]", changed.has(sw.capability) && "bg-info-bg/50")} data-section={sw.section} data-access={sw.access}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
                  {sw.section}
                  {changed.has(sw.capability) && <Badge className="bg-info-bg text-primary">{t("team.permissions.changed")}</Badge>}
                </span>
                <span className={cn("block text-[12px]", sw.access === "work" ? "text-paid" : "text-on-surface-muted")}>{ACCESS_LABELS[sw.access]}</span>
              </span>
              <Switch checked={sw.on} onCheckedChange={(checked) => change([{ capability: sw.capability, granted: checked }])} aria-label={t("team.permissions.sectionSwitch", { section: sw.section })} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-border bg-surface" data-testid="permissions-list">
          {visible.length === 0 && <p className="px-4 py-6 text-[13px] text-on-surface-muted">{changedOnly ? t("team.permissions.nothingChanged") : t("team.permissions.noMatch")}</p>}
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
                    {t("team.common.ofTotal", { granted: on, total: g.capabilities.length })}
                    {on !== was ? t("team.permissions.wasCount", { n: was }) : ""}
                  </span>
                  <Switch checked={all} onCheckedChange={(checked) => change(g.capabilities.map((capability) => ({ capability, granted: checked })))} aria-label={t("team.permissions.everythingIn", { group: g.label })} />
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
                            {changed.has(c) && <Badge className="bg-info-bg text-primary">{t("team.permissions.changed")}</Badge>}
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
          <h3 className="text-[13.5px] font-semibold text-on-surface">{t("team.permissions.membersWillOpen")}</h3>
          <p className="mb-2.5 text-[12.5px] text-on-surface-muted">{t("team.permissions.membersWillOpenNote")}</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {after.all.map((s) => {
              const change = moved.find((m) => m.href === s.href);
              const Icon = s.access === "work" ? CircleCheck : s.access === "view" ? Eye : CircleMinus;
              return (
                <li key={s.href} className={cn("flex items-center gap-2", s.access === "work" ? "text-on-surface" : "text-on-surface-muted")} data-access={s.access}>
                  <Icon size={15} aria-hidden className={s.access === "work" ? "text-paid" : undefined} />
                  <span className="min-w-0 flex-1">
                    {s.label}
                    {s.access === "view" && <span className="text-[12px]">{" "}{t("team.access.viewOnlySuffix")}</span>}
                  </span>
                  <span className="sr-only">{ACCESS_WORDS[s.access]}</span>
                  {change && <Badge className={change.up ? "bg-paid-bg text-paid" : "bg-overdue-bg text-overdue"}>{change.up ? t("team.permissions.added") : t("team.permissions.lost")}</Badge>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-on-surface-muted" aria-hidden>
            <span className="flex items-center gap-1"><CircleCheck size={13} className="text-paid" />{t("team.access.canWorkHere")}</span>
            <span className="flex items-center gap-1"><Eye size={13} />{t("team.access.viewOnly")}</span>
            <span className="flex items-center gap-1"><CircleMinus size={13} />{t("team.access.cantOpen")}</span>
          </p>
          {modules?.ai && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-info-bg p-2.5 text-[12.5px] text-on-surface" data-testid="ai-not-a-section">
              <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              {t("team.permissions.aiNote")}
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-on-surface-muted">{members.length ? t("team.permissions.appliesTo", { people: t("team.common.personCount", { count: members.length }) }) : t("team.permissions.noOneOnTeam")}</p>
        </aside>
      </div>

      {changes.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-on-surface py-2.5 pl-5 pr-3 text-[13.5px] font-medium text-surface shadow-lg" data-testid="permissions-bar" role="region" aria-label={t("team.permissions.unsavedChanges")}>
          {t("team.permissions.changeCount", { count: changes.length })}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(detail.privileges);
              setNotice(null);
            }}
          >
            {t("team.permissions.discard")}
          </Button>
          <Button size="sm" onClick={() => setConfirming(true)}>
            {t("team.permissions.saveChanges")}
          </Button>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.permissions.saveTitle", { count: changes.length, team: detail.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {members.length ? t("team.permissions.getsThis", { count: members.length, names: members.map((m) => m.name).join(", ") }) : t("team.permissions.noOneOnTeam")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-auto text-[13px] text-on-surface" data-testid="save-permissions-list">
            {changes.map((c) => {
              const reason = changeReason(c.capability, c.granted, changes);
              return (
                <li key={c.capability} className="flex items-start gap-2">
                  {c.granted ? <CircleCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-paid" /> : <CircleMinus size={15} aria-hidden className="mt-0.5 shrink-0 text-overdue" />}
                  <span>
                    {c.granted ? t("team.permissions.turnOn") : t("team.permissions.turnOff")} <b className="font-semibold">{CAPABILITY_LABELS[c.capability].label}</b>
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
            <AlertDialogCancel>{t("team.common.goBack")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>
              {saving ? <Spinner size="sm" /> : null}
              {t("team.permissions.saveChanges")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
