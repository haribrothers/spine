"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Info, MoreHorizontal, Pencil, Search, ShieldCheck, ShieldMinus, Trash2, UserMinus, UserPlus } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useConfirm,
  type TableColumn,
} from "@spine/ui";
import type { TeamHistoryEntry } from "@spine/shared";
import { apiClient } from "../../../../../lib/api-client";
import { t, useT } from "../../../../../lib/i18n";
import type { MemberRow } from "../../../../../lib/members";
import { MENU_ICONS } from "../../../../../lib/menu-icons";
import { replaceQuery } from "../../../../../lib/replace-query";
import type { TeamDetail, TeamSummary } from "../../../../../lib/teams";
import { useToast } from "../../../../../components/toast-host";
import { UserAccessDrawer } from "../../users/user-access-drawer";
import { initials, lastActiveLabel, shortDate } from "../../users/users-list-state";
import { TeamDialog, type TeamDialogMode } from "../team-dialog";
import { leftWithoutTeam } from "../teams-state";
import { TeamPermissions } from "./team-permissions";
import { useLoadFailure } from "../../../../../lib/use-load-failure";
import { orgLocaleTag } from "../../../../../lib/money";

type Tab = "members" | "permissions" | "history";
const TABS: Tab[] = ["members", "permissions", "history"];
/** A history entry's time, e.g. "10:42 AM". */
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/** "Arun Shah and Neha Kapoor", "A, B and C". */
function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : t("team.common.andList", { items: list.slice(0, -1).join(", "), last: list[list.length - 1]! });
}

/**
 * US-TEAM-27 to US-TEAM-29 (D-234) — a Team's page: its name, description,
 * badges and a menu (Rename, Duplicate, Delete), with tabs Members,
 * Permissions and History kept in the address. Leaving Permissions with
 * unsaved changes asks first.
 */
export function TeamPage({ teamId }: { teamId: string }) {
  const t = useT();
  const loadFailed = useLoadFailure(teamId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "members");
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(0);
  const [dialog, setDialog] = useState<TeamDialogMode | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<MemberRow | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [d, t, m] = await Promise.all([apiClient.get<TeamDetail>(`/org/teams/${teamId}`), apiClient.get<TeamSummary[]>("/org/teams"), apiClient.get<MemberRow[]>("/org/members")]);
      setDetail(d);
      setTeams(t);
      setMembers(m);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      if (loadFailed(err)) return;
      setLoadError(err instanceof Error ? err.message : t("team.teamPage.loadFailed"));
    }
  }, [teamId, loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  // A refresh or closing the tab with unsaved permissions asks the browser's own question.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function leaveDraft(): Promise<boolean> {
    if (!dirty) return true;
    return confirm({
      title: t("team.teamPage.discardConfirm.title", { count: dirty }),
      description: t("team.teamPage.discardConfirm.description"),
      confirmLabel: t("team.teamPage.discardConfirm.confirm"),
      cancelLabel: t("team.teamPage.discardConfirm.cancel"),
      danger: true,
    });
  }

  async function changeTab(next: Tab) {
    if (tab === "permissions" && next !== "permissions" && !(await leaveDraft())) return;
    if (tab === "permissions") setDirty(0);
    setTab(next);
    replaceQuery(pathname, next === "members" ? "" : `tab=${next}`);
  }

  async function go(href: string) {
    if (await leaveDraft()) {
      setDirty(0);
      router.push(href);
    }
  }

  const teamMembers = useMemo(() => {
    const ids = new Set(detail?.members.map((m) => m.memberId) ?? []);
    return members.filter((m) => ids.has(m.id));
  }, [detail, members]);
  const summary = teams.find((t) => t.id === teamId) ?? null;

  async function setMemberIds(ids: string[]) {
    await apiClient.put(`/org/teams/${teamId}/members`, { memberIds: ids });
    await load();
  }

  async function removeMember(m: MemberRow) {
    if (!detail) return;
    const only = leftWithoutTeam(teamId, [m.id], teams).length > 0;
    const first = m.name.split(" ")[0] ?? "";
    const ok = await confirm({
      title: t("team.teamPage.removeConfirm.title", { name: m.name, team: detail.name }),
      description: (
        <>
          {t("team.teamPage.removeConfirm.description", { team: detail.name })}
          {only && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface" data-testid="remove-only-team">
              {t("team.teamPage.removeConfirm.onlyTeam", { first })}
            </span>
          )}
        </>
      ),
      confirmLabel: t("team.teamPage.removeConfirm.confirm"),
      cancelLabel: t("team.common.goBack"),
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await setMemberIds(detail.members.map((x) => x.memberId).filter((id) => id !== m.id));
      showToast(t("team.teamPage.removedToast.title", { name: m.name, team: detail.name }), only ? t("team.teamPage.removedToast.onlyTeam", { first }) : t("team.teamPage.removedToast.otherTeams"));
    } catch (err) {
      setActionError(`${t("team.teamPage.removeFailed", { name: m.name })} ${err instanceof Error ? err.message : t("team.common.tryAgain")}`);
    }
  }

  async function deleteTeam() {
    if (!detail) return;
    const stranded = leftWithoutTeam(teamId, detail.members.map((m) => m.memberId), teams).map((id) => detail.members.find((m) => m.memberId === id)!.name);
    const ok = await confirm({
      title: t("team.teams.deleteConfirm.title", { name: detail.name }),
      description: (
        <>
          {detail.members.length ? t("team.teams.deleteConfirm.membersLose", { count: detail.members.length }) : t("team.teams.deleteConfirm.noOne")}
          {t("team.teams.deleteConfirm.permissionsGo")}
          {stranded.length > 0 && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface">
              {t("team.teams.deleteConfirm.stranded", { names: names(stranded) })}
              {t("team.teams.deleteConfirm.strandedAfter")}
            </span>
          )}
        </>
      ),
      confirmLabel: t("team.teams.deleteConfirm.confirm"),
      cancelLabel: t("team.common.goBack"),
      danger: true,
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/org/teams/${teamId}`);
      showToast(t("team.teams.deletedToast.title", { name: detail.name }), detail.members.length ? t("team.teams.deletedToast.lost", { count: detail.members.length }) : t("team.teams.deletedToast.noOne"));
      setDirty(0);
      router.push("/team/teams");
    } catch (err) {
      setActionError(`${t("team.teams.deleteFailed", { name: detail.name })} ${err instanceof Error ? err.message : t("team.common.tryAgain")}`);
    }
  }

  if (loadError) {
    return (
      <Alert variant="critical">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }
  if (!detail) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const canDelete = !detail.isDefault && teams.length > 1;
  const header = (
    <AppShellHeader
      breadcrumb={[{ label: t("team.common.breadcrumbTeam") }, { label: t("team.teams.title"), href: "/team/teams" }, { label: detail.name }]}
      title={detail.name}
      description={detail.description ?? undefined}
      action={
        <div className="flex items-center gap-2">
          {detail.isDefault && <Badge className="bg-paid-bg text-paid">{t("team.common.default")}</Badge>}
          {detail.isDemo && <Badge className="bg-due-soon-bg text-due-soon">{t("team.common.demo")}</Badge>}
          {tab === "members" && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={14} aria-hidden />
              {t("team.teamPage.addPeople")}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={t("team.common.actionsFor", { name: detail.name })}>
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => summary && setDialog({ kind: "rename", team: summary })}>
                <MENU_ICONS.edit aria-hidden />
                {t("team.common.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => summary && setDialog({ kind: "create", from: summary })}>
                <MENU_ICONS.duplicate aria-hidden />
                {t("team.common.duplicate")}
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void deleteTeam()}>
                    <MENU_ICONS.delete aria-hidden />
                    {t("team.common.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );

  const memberColumns: TableColumn<MemberRow>[] = [
    {
      key: "person",
      header: t("team.users.columns.person"),
      render: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar className="shrink-0">
            <AvatarFallback>{initials(m.name)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold text-on-surface">{m.name}</span>
            <span className="truncate text-[12.5px] text-on-surface-muted">{m.email}</span>
          </span>
        </span>
      ),
      // US-OPS-56: on a phone, the name on one line and their email on the second.
      phone: "title",
      phoneRender: (m) => m.name,
      sortValue: (m) => m.name.toLowerCase(),
    },
    {
      key: "also",
      phone: "subtitle",
      phoneRender: (m) => m.email,
      header: t("team.teamPage.alsoOn"),
      render: (m) => {
        const other = (m.teams ?? []).filter((team) => team.id !== teamId);
        return other.length ? (
          <span className="flex flex-wrap gap-1.5">
            {other.map((team) => (
              <Link key={team.id} href={`/team/teams/${team.id}`} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface hover:border-primary hover:text-primary">
                {team.name}
              </Link>
            ))}
          </span>
        ) : (
          <span className="text-on-surface-muted">{t("team.teamPage.onlyThisTeam")}</span>
        );
      },
    },
    { key: "lastActive", phone: "trailingSub", header: t("team.users.columns.lastActive"), render: (m) => <span className="whitespace-nowrap">{lastActiveLabel(m.lastActiveAt)}</span>, sortValue: (m) => m.lastActiveAt ?? "" },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (m) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={t("team.common.actionsFor", { name: m.name })} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface">
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => setViewing(m)}>
                <MENU_ICONS.view aria-hidden />
                {t("team.common.whatTheyCanOpen")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void removeMember(m)}>
                <MENU_ICONS.removeMember aria-hidden />
                {t("team.teamPage.removeFrom", { team: detail.name })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      {header}
      {actionError && (
        <Alert variant="critical" className="mb-4">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      <Tabs value={tab} onValueChange={(v) => void changeTab(v as Tab)} className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="members" aria-label={t("team.teamPage.tabs.membersCount", { n: detail.members.length })} className="group">
            {t("team.teamPage.tabs.members")}
            <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">{detail.members.length}</span>
          </TabsTrigger>
          <TabsTrigger value="permissions">{t("team.teamPage.tabs.permissions")}</TabsTrigger>
          <TabsTrigger value="history">{t("team.teamPage.tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="flex flex-col gap-3 pt-0">
          {teamMembers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={<UserPlus />}
                title={t("team.teamPage.empty.title")}
                description={t("team.teamPage.empty.description")}
                action={
                  <Button onClick={() => setAdding(true)}>
                    <UserPlus size={14} aria-hidden />
                    {t("team.teamPage.addPeople")}
                  </Button>
                }
              />
            </div>
          ) : (
            <div data-testid="team-members-table">
              <DataTable columns={memberColumns} data={teamMembers} rowKey={(m) => m.id} />
            </div>
          )}
          <p className="flex items-center gap-1.5 text-[12.5px] text-on-surface-muted">
            <Info size={13} aria-hidden />
            {t("team.teamPage.onlyStaffNote")}
          </p>
        </TabsContent>

        <TabsContent value="permissions" className="pt-0">
          <TeamPermissions
            detail={detail}
            members={teamMembers}
            onDirtyChange={setDirty}
            onSaved={async (count) => {
              await load();
              showToast(t("team.teamPage.savedToast.title", { name: detail.name }), `${t("team.teamPage.savedToast.changed", { count })}${teamMembers.length ? t("team.teamPage.savedToast.membersGet", { count: teamMembers.length, names: names(teamMembers.map((m) => m.name)) }) : ""}.`);
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="pt-0">
          <TeamHistory key={historyKey} teamId={teamId} />
        </TabsContent>
      </Tabs>

      <AddPeopleDialog
        open={adding}
        team={detail}
        candidates={members.filter((m) => m.role === "staff" && m.isActive && !detail.members.some((x) => x.memberId === m.id))}
        onOpenChange={setAdding}
        onAdd={async (picked) => {
          await setMemberIds([...detail.members.map((m) => m.memberId), ...picked.map((m) => m.id)]);
          setAdding(false);
          showToast(t("team.teamPage.addedToast.title", { names: names(picked.map((m) => m.name)), team: detail.name }), t("team.teamPage.addedToast.description"));
        }}
      />
      <TeamDialog
        mode={dialog}
        teams={teams}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={(team, mode) => {
          setDialog(null);
          if (mode.kind === "rename") {
            showToast(t("team.teams.savedToast.title"), t("team.teams.savedToast.description", { name: team.name }));
            void load();
          } else {
            showToast(t("team.teams.createdToast.title", { name: team.name }), t("team.teams.createdToast.description"));
            void go(`/team/teams/${team.id}?tab=permissions`);
          }
        }}
      />
      <UserAccessDrawer member={viewing} onOpenChange={(open) => !open && setViewing(null)} onManageTeams={() => void go("/team/users")} />
      {confirmDialog}
    </>
  );
}

/** US-TEAM-27 · `AddTeamMembersDialog` — tick several Staff not on this Team, with their current Teams. */
function AddPeopleDialog({ open, team, candidates, onOpenChange, onAdd }: { open: boolean; team: TeamDetail; candidates: MemberRow[]; onOpenChange: (open: boolean) => void; onAdd: (picked: MemberRow[]) => Promise<void> }) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPicked([]);
      setQ("");
      setError(null);
    }
  }, [open]);

  const shown = candidates.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  async function add() {
    setSaving(true);
    setError(null);
    try {
      await onAdd(candidates.filter((m) => picked.includes(m.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("team.addPeopleDialog.failed"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("team.addPeopleDialog.title", { team: team.name })}</DialogTitle>
          <DialogDescription>{t("team.addPeopleDialog.description", { team: team.name })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {candidates.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">{t("team.addPeopleDialog.everyoneOn", { team: team.name })}</p>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
                <Input type="search" aria-label={t("team.addPeopleDialog.searchStaff")} placeholder={t("team.addPeopleDialog.searchStaff")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <div role="group" aria-label={t("team.addPeopleDialog.staffToAdd")} className="flex max-h-72 flex-col overflow-auto rounded-lg border border-border">
                {shown.map((m) => {
                  const id = `add-${m.id}`;
                  const teamsLabel = (m.teams ?? []).map((tm) => tm.name).join(", ");
                  return (
                    <label key={m.id} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-3 py-2 text-[13.5px] text-on-surface first:border-t-0 hover:bg-surface-sunken">
                      <Checkbox id={id} checked={picked.includes(m.id)} onCheckedChange={(on) => setPicked((p) => (on === true ? [...p, m.id] : p.filter((x) => x !== m.id)))} />
                      <span className="flex-1">{m.name}</span>
                      <span className={teamsLabel ? "text-[12.5px] text-on-surface-muted" : "text-[12.5px] font-medium text-due-soon"}>{teamsLabel || t("team.addPeopleDialog.noTeam")}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[12.5px] text-on-surface-muted">{t("team.addPeopleDialog.notListed")}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("team.common.cancel")}
          </Button>
          <Button onClick={() => void add()} disabled={saving || picked.length === 0}>
            {saving ? <Spinner size="sm" /> : <UserPlus size={14} aria-hidden />}
            {t("team.addPeopleDialog.submit", { count: picked.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** US-TEAM-29 · `TeamPageHistory` — every change to the Team, newest first. */
function TeamHistory({ teamId }: { teamId: string }) {
  const t = useT();
  const [entries, setEntries] = useState<TeamHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<TeamHistoryEntry[]>(`/org/teams/${teamId}/history`)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : t("team.history.loadFailed")));
  }, [teamId]);

  if (error)
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!entries)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">{t("team.history.empty")}</p>
      ) : (
        <ol className="rounded-lg border border-border bg-surface" data-testid="team-history">
          {entries.map((e, i) => {
            const d = describe(e);
            const Icon = d.icon;
            return (
              <li key={i} className="flex gap-3 border-t border-border px-4 py-3.5 text-[13.5px] text-on-surface first:border-t-0">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-surface-sunken text-on-surface-muted">
                  <Icon size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span>
                    <b className="font-semibold">{e.actorName ?? t("team.history.someone")}</b> {d.text}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-on-surface-muted">
                    {shortDate(e.at)}, {new Date(e.at).toLocaleTimeString(orgLocaleTag(), TIME_FORMAT)}
                  </span>
                  {d.chips.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {d.chips.map((c) => (
                        <span key={c} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface">
                          {c}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <Link href={`/team/audit-log?entityType=team&entityId=${teamId}`} className="w-fit text-[13px] font-medium text-primary hover:underline">
        {t("team.history.openInAuditLog")}
      </Link>
    </div>
  );
}

/** One history entry as a sentence, its chips and its icon. */
export function describe(e: TeamHistoryEntry): { text: string; chips: string[]; icon: typeof Pencil } {
  const changes = e.changes ?? [];
  const get = (field: string) => changes.find((c) => c.field === field);
  switch (e.action) {
    case "created": {
      const from = get("copiedFrom")?.to;
      return { text: `${t("team.history.created", { name: String(get("name")?.to ?? t("team.history.theTeam")) })}${from ? t("team.history.createdFrom", { from: String(from) }) : ""}`, chips: [], icon: from ? Copy : ShieldCheck };
    }
    case "updated":
      return {
        text: changes.length === 1 ? t("team.history.changedField", { field: changes[0]!.field }) : t("team.history.changedNameAndDescription"),
        chips: changes.map((c) => `${c.from ?? "—"} → ${c.to ?? "—"}`),
        icon: Pencil,
      };
    case "members_changed": {
      const added = get("added")?.to;
      const removed = get("removed")?.from;
      const parts = [added ? t("team.history.added", { who: String(added) }) : null, removed ? t("team.history.removed", { who: String(removed) }) : null].filter(Boolean);
      return { text: parts.join(t("team.common.andSeparator")), chips: [], icon: removed && !added ? UserMinus : UserPlus };
    }
    case "privileges_changed": {
      const on = changes.filter((c) => c.to === "On").map((c) => c.field);
      const off = changes.filter((c) => c.to === "Off").map((c) => c.field);
      const text = on.length && !off.length ? t("team.history.turnedOn", { names: names(on) }) : off.length && !on.length ? t("team.history.turnedOff", { names: names(off) }) : t("team.history.changedCount", { n: changes.length });
      return { text, chips: [...on.map((l) => `+ ${l}`), ...off.map((l) => `− ${l}`)], icon: off.length && !on.length ? ShieldMinus : ShieldCheck };
    }
    case "deleted":
      return { text: t("team.history.deleted"), chips: [], icon: Trash2 };
    default:
      return { text: e.action.replace(/_/g, " "), chips: [], icon: Pencil };
  }
}
