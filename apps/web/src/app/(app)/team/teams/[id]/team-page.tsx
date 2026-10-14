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
import type { MemberRow } from "../../../../../lib/members";
import { MENU_ICONS } from "../../../../../lib/menu-icons";
import { replaceQuery } from "../../../../../lib/replace-query";
import type { TeamDetail, TeamSummary } from "../../../../../lib/teams";
import { useToast } from "../../../../../components/toast-host";
import { UserAccessDrawer } from "../../users/user-access-drawer";
import { initials, lastActiveLabel, shortDate } from "../../users/users-list-state";
import { TeamDialog, type TeamDialogMode } from "../team-dialog";
import { leftWithoutTeam, peopleLabel } from "../teams-state";
import { TeamPermissions } from "./team-permissions";

type Tab = "members" | "permissions" | "history";
const TABS: Tab[] = ["members", "permissions", "history"];

/** "Arun Shah and Neha Kapoor", "A, B and C". */
function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * US-TEAM-27 to US-TEAM-29 (D-234) — a Team's page: its name, description,
 * badges and a menu (Rename, Duplicate, Delete), with tabs Members,
 * Permissions and History kept in the address. Leaving Permissions with
 * unsaved changes asks first.
 */
export function TeamPage({ teamId }: { teamId: string }) {
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
      setLoadError(err instanceof Error ? err.message : "Couldn't load this Team. Go back to Teams and try again.");
    }
  }, [teamId]);

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
      title: `Discard ${dirty === 1 ? "1 unsaved change" : `${dirty} unsaved changes`}?`,
      description: "The permissions you switched haven't been saved. Nothing changes for anyone if you leave now.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
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
    const first = m.name.split(" ")[0];
    const ok = await confirm({
      title: `Remove ${m.name} from ${detail.name}?`,
      description: (
        <>
          They lose what {detail.name} allowed at their next request.
          {only && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface" data-testid="remove-only-team">
              This is their only Team — {first} will be on no Team and can&apos;t open anything until you add them to one.
            </span>
          )}
        </>
      ),
      confirmLabel: "Remove",
      cancelLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await setMemberIds(detail.members.map((x) => x.memberId).filter((id) => id !== m.id));
      showToast(`${m.name} removed from ${detail.name}`, only ? `${first} is on no Team now — they can't open anything.` : `They keep what their other Teams allow.`);
    } catch (err) {
      setActionError(`Couldn't remove ${m.name}. ${err instanceof Error ? err.message : "Try again."}`);
    }
  }

  async function deleteTeam() {
    if (!detail) return;
    const stranded = leftWithoutTeam(teamId, detail.members.map((m) => m.memberId), teams).map((id) => detail.members.find((m) => m.memberId === id)!.name);
    const ok = await confirm({
      title: `Delete ${detail.name}?`,
      description: (
        <>
          {detail.members.length ? `Its ${peopleLabel(detail.members.length)} ${detail.members.length === 1 ? "loses" : "lose"} what it allowed.` : "No one is on it."} Its permissions and history go; nobody&apos;s login does.
          {stranded.length > 0 && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface">
              {names(stranded)} will be on no Team — they can&apos;t open anything until you add them to one.
            </span>
          )}
        </>
      ),
      confirmLabel: "Delete Team",
      cancelLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/org/teams/${teamId}`);
      showToast(`${detail.name} deleted`, detail.members.length ? `${peopleLabel(detail.members.length)} lost what it allowed.` : "No one was on it.");
      setDirty(0);
      router.push("/team/teams");
    } catch (err) {
      setActionError(`Couldn't delete ${detail.name}. ${err instanceof Error ? err.message : "Try again."}`);
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
      breadcrumb={[{ label: "Team" }, { label: "Teams", href: "/team/teams" }, { label: detail.name }]}
      title={detail.name}
      description={detail.description ?? undefined}
      action={
        <div className="flex items-center gap-2">
          {detail.isDefault && <Badge className="bg-paid-bg text-paid">Default</Badge>}
          {detail.isDemo && <Badge className="bg-due-soon-bg text-due-soon">Demo</Badge>}
          {tab === "members" && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={14} aria-hidden />
              Add people
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={`Actions for ${detail.name}`}>
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => summary && setDialog({ kind: "rename", team: summary })}>
                <MENU_ICONS.edit aria-hidden />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => summary && setDialog({ kind: "create", from: summary })}>
                <MENU_ICONS.duplicate aria-hidden />
                Duplicate
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void deleteTeam()}>
                    <MENU_ICONS.delete aria-hidden />
                    Delete
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
      header: "Person",
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
      sortValue: (m) => m.name.toLowerCase(),
    },
    {
      key: "also",
      header: "Also on",
      render: (m) => {
        const other = (m.teams ?? []).filter((t) => t.id !== teamId);
        return other.length ? (
          <span className="flex flex-wrap gap-1.5">
            {other.map((t) => (
              <Link key={t.id} href={`/team/teams/${t.id}`} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface hover:border-primary hover:text-primary">
                {t.name}
              </Link>
            ))}
          </span>
        ) : (
          <span className="text-on-surface-muted">Only this Team</span>
        );
      },
    },
    { key: "lastActive", header: "Last active", render: (m) => <span className="whitespace-nowrap">{lastActiveLabel(m.lastActiveAt)}</span>, sortValue: (m) => m.lastActiveAt ?? "" },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Actions for ${m.name}`} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface">
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => setViewing(m)}>
                <MENU_ICONS.view aria-hidden />
                What they can open
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void removeMember(m)}>
                <MENU_ICONS.removeMember aria-hidden />
                Remove from {detail.name}
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
          <TabsTrigger value="members" aria-label={`Members, ${detail.members.length}`} className="group">
            Members
            <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">{detail.members.length}</span>
          </TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="flex flex-col gap-3 pt-0">
          {teamMembers.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={<UserPlus />}
                title="No one on this Team yet"
                description="Add Staff to give them what it allows."
                action={
                  <Button onClick={() => setAdding(true)}>
                    <UserPlus size={14} aria-hidden />
                    Add people
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
            Only Staff are on Teams. Owners can open everything; Field access is fixed.
          </p>
        </TabsContent>

        <TabsContent value="permissions" className="pt-0">
          <TeamPermissions
            detail={detail}
            members={teamMembers}
            onDirtyChange={setDirty}
            onSaved={async (count) => {
              await load();
              showToast(`${detail.name} saved`, `${count === 1 ? "1 permission" : `${count} permissions`} changed${teamMembers.length ? ` — ${names(teamMembers.map((m) => m.name))} get${teamMembers.length === 1 ? "s" : ""} them at their next request` : ""}.`);
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
          showToast(`Added ${names(picked.map((m) => m.name))} to ${detail.name}`, "They can open what it allows at their next request.");
        }}
      />
      <TeamDialog
        mode={dialog}
        teams={teams}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaved={(team, mode) => {
          setDialog(null);
          if (mode.kind === "rename") {
            showToast("Team saved", `${team.name} is up to date.`);
            void load();
          } else {
            showToast(`${team.name} created`, "Check what it allows, then add people.");
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
      setError(err instanceof Error ? err.message : "Couldn't add them. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add people to {team.name}</DialogTitle>
          <DialogDescription>They can open what {team.name} allows, on top of their other Teams.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {candidates.length === 0 ? (
            <p className="text-[13px] text-on-surface-muted">Every Staff member is already on {team.name}.</p>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
                <Input type="search" aria-label="Search Staff" placeholder="Search Staff" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <div role="group" aria-label="Staff to add" className="flex max-h-72 flex-col overflow-auto rounded-lg border border-border">
                {shown.map((m) => {
                  const id = `add-${m.id}`;
                  const teamsLabel = (m.teams ?? []).map((t) => t.name).join(", ");
                  return (
                    <label key={m.id} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-3 py-2 text-[13.5px] text-on-surface first:border-t-0 hover:bg-surface-sunken">
                      <Checkbox id={id} checked={picked.includes(m.id)} onCheckedChange={(on) => setPicked((p) => (on === true ? [...p, m.id] : p.filter((x) => x !== m.id)))} />
                      <span className="flex-1">{m.name}</span>
                      <span className={teamsLabel ? "text-[12.5px] text-on-surface-muted" : "text-[12.5px] font-medium text-due-soon"}>{teamsLabel || "No Team"}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[12.5px] text-on-surface-muted">Owners and Field aren&apos;t listed — only Staff are on Teams.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void add()} disabled={saving || picked.length === 0}>
            {saving ? <Spinner size="sm" /> : <UserPlus size={14} aria-hidden />}
            {picked.length === 1 ? "Add 1 person" : `Add ${picked.length} people`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** US-TEAM-29 · `TeamPageHistory` — every change to the Team, newest first. */
function TeamHistory({ teamId }: { teamId: string }) {
  const [entries, setEntries] = useState<TeamHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<TeamHistoryEntry[]>(`/org/teams/${teamId}/history`)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the history."));
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
        <p className="text-[13px] text-on-surface-muted">Nothing has changed on this Team since history began.</p>
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
                    <b className="font-semibold">{e.actorName ?? "Someone"}</b> {d.text}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-on-surface-muted">
                    {shortDate(e.at)}, {new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
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
        Open in audit log →
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
      return { text: `created ${String(get("name")?.to ?? "the Team")}${from ? ` from ${String(from)}` : ""}`, chips: [], icon: from ? Copy : ShieldCheck };
    }
    case "updated":
      return {
        text: changes.length === 1 ? `changed the ${changes[0]!.field}` : "changed the name and description",
        chips: changes.map((c) => `${c.from ?? "—"} → ${c.to ?? "—"}`),
        icon: Pencil,
      };
    case "members_changed": {
      const added = get("added")?.to;
      const removed = get("removed")?.from;
      const parts = [added ? `added ${String(added)}` : null, removed ? `removed ${String(removed)}` : null].filter(Boolean);
      return { text: parts.join(" and "), chips: [], icon: removed && !added ? UserMinus : UserPlus };
    }
    case "privileges_changed": {
      const on = changes.filter((c) => c.to === "On").map((c) => c.field);
      const off = changes.filter((c) => c.to === "Off").map((c) => c.field);
      const text = on.length && !off.length ? `turned on ${names(on)}` : off.length && !on.length ? `turned off ${names(off)}` : `changed ${changes.length} permissions`;
      return { text, chips: [...on.map((l) => `+ ${l}`), ...off.map((l) => `− ${l}`)], icon: off.length && !on.length ? ShieldMinus : ShieldCheck };
    }
    case "deleted":
      return { text: "deleted the Team", chips: [], icon: Trash2 };
    default:
      return { text: e.action.replace(/_/g, " "), chips: [], icon: Pencil };
  }
}
