"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ListFilter, MoreHorizontal, RefreshCw, Search, TriangleAlert, UserPlus, Users } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  TableSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  useConfirm,
  type TableColumn,
} from "@spine/ui";
import type { InviteMembersResult } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import type { InvitationRow } from "../../../../lib/invitations";
import type { MemberRow } from "../../../../lib/members";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import { replaceQuery } from "../../../../lib/replace-query";
import { useToast } from "../../../../components/toast-host";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../../contacts/contacts-list-state";
import { ChangeRoleDialog } from "./change-role-dialog";
import { InvitePeopleDialog } from "./invite-people-dialog";
import { ManageTeamsDialog } from "./manage-teams-dialog";
import type { TeamOption } from "./team-checklist";
import { TransferPrimaryOwnerDialog } from "./transfer-primary-owner-dialog";
import { UserAccessDrawer } from "./user-access-drawer";
import {
  ROLE_LABELS,
  expiresLabel,
  filterInvites,
  filterMembers,
  initials,
  isExpired,
  lastActiveLabel,
  parseUsersState,
  shortDate,
  teamsSentence,
  usersQuery,
  usersTotals,
  type UsersListState,
  type UsersRole,
  type UsersTab,
} from "./users-list-state";

const MEMBER_COLUMNS = [
  { key: "person", header: "Person", width: "w-56" },
  { key: "role", header: "Role", width: "w-20" },
  { key: "teams", header: "Teams", width: "w-48" },
  { key: "lastActive", header: "Last active", width: "w-28" },
  { key: "joined", header: "Joined", width: "w-24" },
];

const ALL_ROLES = "__all__";

/**
 * US-TEAM-19 to US-TEAM-23 (D-232) — `TeamUsersRefined`: everyone with
 * access, on the list layout every refined list shares — "Invite people"
 * in the header; tabs Active, Deactivated and Invites; the cards (Staff
 * without a Team filters); the filter bar (Role; Updated, Refresh) and the
 * search bar, all kept in the address. Each row shows the person's Teams
 * and when they were last active, and its menu acts on that person, asking
 * first and saying what happened.
 */
export function UsersExplorer({ currentMemberId }: { currentMemberId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersListState>(() => parseUsersState(new URLSearchParams(searchParams.toString())));
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InvitationRow[] | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [businessName, setBusinessName] = useState("your business");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<MemberRow | null>(null);
  const [viewing, setViewing] = useState<MemberRow | null>(null);
  const [changingRole, setChangingRole] = useState<MemberRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const loading = useRef(false);
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  function update(patch: Partial<UsersListState>) {
    const next = { ...state, ...patch };
    setState(next);
    replaceQuery(pathname, usersQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh" = "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const [memberRows, inviteRows, teamRows] = await Promise.all([apiClient.get<MemberRow[]>("/org/members"), apiClient.get<InvitationRow[]>("/org/invitations"), apiClient.get<TeamOption[]>("/org/teams")]);
      setMembers(memberRows);
      setInvites(inviteRows);
      setTeams(teamRows);
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (mode === "first") setLoadError(err instanceof Error ? err.message : "Couldn't load your people. Refresh to try again.");
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient
      .get<{ value: { name?: string } | null }>("/org/settings/business_profile")
      .then((res) => res.value?.name && setBusinessName(res.value.name))
      .catch(() => undefined);
  }, [load]);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(() => (members && invites ? usersTotals(members, invites, now) : null), [members, invites, now]);
  const memberRows = useMemo(() => (members ? filterMembers(members, state) : null), [members, state]);
  const inviteRows = useMemo(() => (invites ? filterInvites(invites, state) : null), [invites, state]);
  const activeCount = members?.filter((m) => m.isActive).length ?? 0;
  const deactivatedCount = members ? members.length - activeCount : 0;
  const otherOwners = (members ?? []).filter((m) => m.role === "owner" && m.isActive && m.id !== currentMemberId);

  /** Runs a people action; success toasts what happened (D-223), a failure says what to do next above the list. */
  async function act(action: () => Promise<unknown>, success: [string, string], failure: string) {
    setActionError(null);
    try {
      await action();
      showToast(success[0], success[1]);
      await load();
      return true;
    } catch (err) {
      setActionError(`${failure} ${err instanceof Error ? err.message : "Try again."}`);
      return false;
    }
  }

  async function deactivate(member: MemberRow) {
    const ok = await confirm({
      title: `Deactivate ${member.name}?`,
      description: `They can't sign in or open anything in ${businessName} from now on. Their records, history and Teams stay, and you can reactivate them from Deactivated.${member.isDemo ? " They're demo data, so they go when the demo data is deleted." : ""}`,
      confirmLabel: "Deactivate",
      cancelLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/deactivate`), [`${member.name} deactivated`, "They can't sign in now. They're under Deactivated."], `Couldn't deactivate ${member.name}.`);
  }

  async function reactivate(member: MemberRow) {
    const ok = await confirm({
      title: `Reactivate ${member.name}?`,
      description: `They get their previous role (${ROLE_LABELS[member.role] ?? member.role}) and Teams back, and can sign in to ${businessName} again.`,
      confirmLabel: "Reactivate",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/reactivate`), [`${member.name} reactivated`, "They can sign in again."], `Couldn't reactivate ${member.name}.`);
  }

  async function promote(member: MemberRow) {
    // US-TEAM-16 (D-059): granting full access is confirmed first; a primary, not danger, action (D-058).
    const ok = await confirm({
      title: `Make ${member.name} an owner?`,
      description: `Owners have full access to everything in ${businessName} — every record and report, plus Users, Teams and Settings. Team permissions no longer apply to ${member.name}. Any owner can change them back to Staff later.`,
      confirmLabel: "Make owner",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/promote`), [`${member.name} is an owner`, "They can open everything now."], `Couldn't make ${member.name} an owner.`);
  }

  async function demote(member: MemberRow) {
    const ok = await confirm({
      title: `Demote ${member.name} to Staff?`,
      description: "They lose Owner access at once. They keep any Teams they're on — with none, they can't open anything until you add them to one.",
      confirmLabel: "Demote",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/demote`), [`${member.name} is Staff`, "Their Teams decide what they can open."], `Couldn't demote ${member.name}.`);
  }

  async function saveTeams(member: MemberRow, teamIds: string[]) {
    const updated = await apiClient.put<MemberRow>(`/org/members/${member.id}/teams`, { teamIds });
    setManaging(null);
    showToast("Teams saved", teamsSentence(member.name, updated.teams ?? []));
    void load();
  }

  async function changeRole(member: MemberRow, role: "staff" | "field", teamIds: string[]) {
    setChangingRole(null);
    await act(
      () => apiClient.put(`/org/members/${member.id}/role`, role === "staff" ? { role, teamIds } : { role }),
      [`${member.name} is ${role === "staff" ? "Staff" : "Field"}`, role === "staff" ? "Their Teams decide what they can open." : "They see the jobs they're assigned to, without money."],
      `Couldn't change ${member.name}'s role.`,
    );
  }

  function invited(result: InviteMembersResult) {
    void load();
    if (result.invited.length > 0) {
      showToast(
        result.invited.length === 1 ? `Invite sent to ${result.invited[0]!.email}` : `${result.invited.length} invites sent`,
        result.skipped.length > 0 ? `${result.skipped.length} weren't invited — see why in the dialog.` : "They'll appear under Users once they accept.",
      );
    }
  }

  async function copyLink(invite: InvitationRow) {
    if (!invite.acceptUrl) return;
    try {
      await navigator.clipboard.writeText(invite.acceptUrl);
      showToast("Invite link copied", `Only ${invite.email} can use it, signed in with that address.`);
    } catch {
      showToast("Here's the invite link", invite.acceptUrl);
    }
  }

  async function resend(invite: InvitationRow) {
    await act(() => apiClient.post(`/org/invitations/${invite.id}/resend`), [`Invite sent again to ${invite.email}`, "Same link — its time limit starts over."], `Couldn't resend the invite to ${invite.email}.`);
  }

  async function cancelInvite(invite: InvitationRow) {
    const ok = await confirm({
      title: "Cancel this invitation?",
      description: `The link sent to ${invite.email} stops working, so they can't join. You can invite them again.`,
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep invitation",
      danger: true,
    });
    if (!ok) return;
    await act(() => apiClient.delete(`/org/invitations/${invite.id}`), ["Invitation cancelled", `The link sent to ${invite.email} no longer works.`], "Couldn't cancel the invitation.");
  }

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
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-on-surface">{m.name}</span>
              {m.id === currentMemberId && <Badge className="bg-primary/10 text-primary">You</Badge>}
              {m.isPrimaryOwner && <Badge className="bg-paid-bg text-paid">Primary Owner</Badge>}
              {m.isDemo && <Badge className="bg-due-soon-bg text-due-soon">Demo</Badge>}
              {!m.isActive && <Badge>Deactivated</Badge>}
            </span>
            <span className="truncate text-[12.5px] text-on-surface-muted">{m.email}</span>
          </span>
        </span>
      ),
      sortValue: (m) => m.name.toLowerCase(),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => ROLE_LABELS[m.role] ?? m.role,
      sortValue: (m) => m.role,
    },
    {
      key: "teams",
      header: "Teams",
      render: (m) =>
        m.role === "owner" ? (
          <span className="text-on-surface-muted">Everything</span>
        ) : m.role === "field" ? (
          <span className="text-on-surface-muted">Field access</span>
        ) : (m.teams?.length ?? 0) === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-due-soon">
            <TriangleAlert size={14} aria-hidden />
            No Team — can&apos;t open anything
          </span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {m.teams!.map((t) => (
              <Link key={t.id} href={`/team/teams/${t.id}`} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface hover:border-primary hover:text-primary">
                {t.name}
              </Link>
            ))}
          </span>
        ),
      sortValue: (m) => (m.teams ?? []).map((t) => t.name).join(", "),
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (m) => <span className={cn("whitespace-nowrap", !m.lastActiveAt && "text-on-surface-muted")}>{lastActiveLabel(m.lastActiveAt, now)}</span>,
      sortValue: (m) => m.lastActiveAt ?? "",
    },
    {
      key: "joined",
      header: "Joined",
      render: (m) => <span className="whitespace-nowrap">{shortDate(m.createdAt, now)}</span>,
      sortValue: (m) => m.createdAt,
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <div className="flex justify-end">
          <MemberMenu
            member={m}
            isMe={m.id === currentMemberId}
            canTransfer={m.isPrimaryOwner && m.id === currentMemberId}
            onView={() => setViewing(m)}
            onManageTeams={() => setManaging(m)}
            onChangeRole={() => setChangingRole(m)}
            onPromote={() => void promote(m)}
            onDemote={() => void demote(m)}
            onTransfer={() => setTransferOpen(true)}
            onDeactivate={() => void deactivate(m)}
            onReactivate={() => void reactivate(m)}
          />
        </div>
      ),
    },
  ];

  const inviteColumns: TableColumn<InvitationRow>[] = [
    {
      key: "email",
      header: "Email",
      render: (i) => <span className="font-semibold text-on-surface">{i.email}</span>,
      sortValue: (i) => i.email,
    },
    {
      key: "role",
      header: "Role",
      render: (i) => ROLE_LABELS[i.role] ?? i.role,
      sortValue: (i) => i.role,
    },
    {
      key: "teams",
      header: "Teams on joining",
      render: (i) =>
        i.teams && i.teams.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {i.teams.map((t) => (
              <span key={t.id} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface">
                {t.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-on-surface-muted">—</span>
        ),
    },
    {
      key: "invited",
      header: "Invited",
      render: (i) => <span className="whitespace-nowrap">{[i.inviterName, i.createdAt ? shortDate(i.createdAt, now) : null].filter(Boolean).join(" · ")}</span>,
      sortValue: (i) => i.createdAt ?? "",
    },
    {
      key: "expires",
      header: "Expires",
      render: (i) => <span className={cn("whitespace-nowrap", isExpired(i, now) && "font-medium text-overdue")}>{expiresLabel(i.expiresAt, now)}</span>,
      sortValue: (i) => i.expiresAt,
    },
    {
      key: "actions",
      header: "",
      render: (i) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for the invite to ${i.email}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {!isExpired(i, now) && (
                <DropdownMenuItem onSelect={() => void copyLink(i)}>
                  <MENU_ICONS.copyLink aria-hidden />
                  Copy invite link
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void resend(i)}>
                <MENU_ICONS.send aria-hidden />
                Resend
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void cancelInvite(i)}>
                <MENU_ICONS.cancel aria-hidden />
                Cancel invite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: "Team" }, { label: "Users" }]}
      title="Users"
      description={`Everyone with access to ${businessName}, and the invites on their way.`}
      action={
        <Button onClick={() => setInviting(true)}>
          <UserPlus size={14} aria-hidden />
          Invite people
        </Button>
      }
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </>
    );
  }

  const onInvites = state.tab === "invites";
  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input
        type="search"
        placeholder={onInvites ? "Search emails" : "Search names or emails"}
        aria-label={onInvites ? "Search emails" : "Search names or emails"}
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        className="pl-9"
      />
    </div>
  );
  const filtered = Boolean(state.q.trim() || state.role || state.noTeam);
  const clear = (
    <Button variant="secondary" onClick={() => update({ role: null, noTeam: false, q: "" })}>
      Clear filters
    </Button>
  );

  return (
    <>
      {header}
      <Tabs
        value={state.tab}
        onValueChange={(tab) =>
          update({
            tab: tab as UsersTab,
            noTeam: tab === "active" ? state.noTeam : false,
          })
        }
        className="flex flex-col gap-6"
      >
        <TabsList>
          <TabsTrigger value="active" className="group" aria-label={members ? `Active, ${activeCount}` : "Active"}>
            Active
            {members && <Count n={activeCount} />}
          </TabsTrigger>
          <TabsTrigger value="deactivated" className="group" aria-label={members ? `Deactivated, ${deactivatedCount}` : "Deactivated"}>
            Deactivated
            {members && <Count n={deactivatedCount} />}
          </TabsTrigger>
          <TabsTrigger value="invites" className="group" aria-label={invites ? `Invites, ${invites.length}` : "Invites"}>
            Invites
            {invites && <Count n={invites.length} />}
          </TabsTrigger>
        </TabsList>

        {/* The tab's panel holds the cards, filters and list, so the active tab controls something real (WCAG 4.1.2). */}
        <TabsContent value={state.tab} className="flex flex-col gap-6 pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="users-cards">
            <StatCard label="People" value={totals ? String(totals.people) : "—"} trend={totals ? { direction: "neutral", label: totals.peopleLabel } : undefined} className="h-full" />
            <button
              type="button"
              aria-pressed={state.noTeam}
              aria-label="Show Staff without a Team only"
              onClick={() => update({ noTeam: !state.noTeam, tab: "active" })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label="Staff without a Team"
                value={totals ? String(totals.noTeam) : "—"}
                tone={totals && totals.noTeam > 0 ? "warning" : "default"}
                trend={{
                  direction: "neutral",
                  label: state.noTeam ? "Showing these · press again to clear" : totals && totals.noTeam > 0 ? "can't open anything yet" : "everyone can work",
                }}
                className={cn("h-full transition-colors hover:border-border-strong", state.noTeam && "border-primary bg-info-bg/60 ring-1 ring-primary")}
              />
              <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", state.noTeam ? "text-primary" : "text-on-surface-muted")} />
            </button>
            <button
              type="button"
              aria-label="Open Invites"
              onClick={() => update({ tab: "invites", noTeam: false })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label="Pending invites"
                value={totals ? String(totals.invites) : "—"}
                trend={totals ? { direction: "neutral", label: totals.invitesLabel } : undefined}
                className="h-full transition-colors hover:border-border-strong"
              />
              <ArrowUpRight size={14} aria-hidden className="absolute right-4 top-4 text-on-surface-muted" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={state.role ?? ALL_ROLES} onValueChange={(v) => update({ role: v === ALL_ROLES ? null : (v as UsersRole) })}>
              <SelectTrigger aria-label="Filter by role" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>All roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="field">Field</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {updatedAt !== null && (
                <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="users-updated">
                  {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing} onClick={() => void load()}>
                    <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh list</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {actionError && (
            <Alert variant="critical" data-testid="users-action-error">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {onInvites ? (
            !inviteRows ? (
              <TableSkeleton columns={MEMBER_COLUMNS} />
            ) : inviteRows.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex">{search}</div>
                <div className="rounded-lg border border-border bg-surface">
                  {filtered ? (
                    <EmptyState icon={<Users />} title="No invites match" description="Clear the filters to see every invite." action={clear} />
                  ) : (
                    <EmptyState
                      icon={<UserPlus />}
                      title="No invites waiting"
                      description="Invite people to give them their own sign-in."
                      action={
                        <Button onClick={() => setInviting(true)}>
                          <UserPlus size={14} aria-hidden />
                          Invite people
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            ) : (
              <div data-testid="invites-table">
                <DataTable columns={inviteColumns} data={inviteRows} rowKey={(i) => i.id} toolbarStart={search} configurablePageSize />
              </div>
            )
          ) : !memberRows ? (
            <TableSkeleton columns={MEMBER_COLUMNS} />
          ) : memberRows.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex">{search}</div>
              <div className="rounded-lg border border-border bg-surface">
                {state.tab === "deactivated" && !filtered ? (
                  <EmptyState icon={<Users />} title="Nobody is deactivated" description="People you deactivate appear here, and can be reactivated." />
                ) : state.noTeam && !state.q.trim() && !state.role ? (
                  <EmptyState icon={<Users />} title="Every Staff member is on a Team" description="Everyone can open what their Teams allow." action={clear} />
                ) : (
                  <EmptyState icon={<Users />} title="No one matches" description="Clear the filters to see everyone." action={clear} />
                )}
              </div>
            </div>
          ) : (
            <div data-testid="users-table">
              <DataTable columns={memberColumns} data={memberRows} rowKey={(m) => m.id} toolbarStart={search} configurablePageSize />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InvitePeopleDialog open={inviting} onOpenChange={setInviting} teams={teams} businessName={businessName} onInvited={invited} />
      <ManageTeamsDialog member={managing} teams={teams} onOpenChange={(open) => !open && setManaging(null)} onSave={saveTeams} />
      <ChangeRoleDialog member={changingRole} teams={teams} onOpenChange={(open) => !open && setChangingRole(null)} onConfirm={(m, role, ids) => void changeRole(m, role, ids)} />
      <UserAccessDrawer
        member={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onManageTeams={(m) => {
          setViewing(null);
          setManaging(m);
        }}
      />
      <TransferPrimaryOwnerDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        owners={otherOwners}
        onTransfer={async (newPrimaryOwnerMemberId) => {
          const to = otherOwners.find((o) => o.id === newPrimaryOwnerMemberId);
          await act(
            () =>
              apiClient.post("/org/members/transfer-primary-owner", {
                newPrimaryOwnerMemberId,
              }),
            ["Primary ownership transferred", `${to?.name ?? "They"} is the Primary Owner now.`],
            "Couldn't transfer primary ownership.",
          );
        }}
      />
      {confirmDialog}
    </>
  );
}

/**
 * US-TEAM-19 — a person's menu: each action with its icon (D-222), only
 * where it applies. Your own row has no Deactivate (US-TEAM-23); the
 * Primary Owner's offers only the transfer, to the Primary Owner.
 */
function MemberMenu({
  member,
  isMe,
  canTransfer,
  onView,
  onManageTeams,
  onChangeRole,
  onPromote,
  onDemote,
  onTransfer,
  onDeactivate,
  onReactivate,
}: {
  member: MemberRow;
  isMe: boolean;
  canTransfer: boolean;
  onView: () => void;
  onManageTeams: () => void;
  onChangeRole: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onTransfer: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const active = member.isActive;
  const staff = member.role === "staff";
  const field = member.role === "field";
  const canDemote = member.role === "owner" && !member.isPrimaryOwner && !isMe;
  const canDeactivate = active && !isMe && !member.isPrimaryOwner;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${member.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={onView}>
          <MENU_ICONS.view aria-hidden />
          What they can open
        </DropdownMenuItem>
        {active && staff && (
          <DropdownMenuItem onSelect={onManageTeams}>
            <MENU_ICONS.manageTeams aria-hidden />
            Manage Teams
          </DropdownMenuItem>
        )}
        {active && (staff || field) && (
          <DropdownMenuItem onSelect={onChangeRole}>
            <MENU_ICONS.changeRole aria-hidden />
            {staff ? "Change to Field" : "Change to Staff"}
          </DropdownMenuItem>
        )}
        {active && staff && (
          <DropdownMenuItem onSelect={onPromote}>
            <MENU_ICONS.promote aria-hidden />
            Promote to Owner
          </DropdownMenuItem>
        )}
        {active && canDemote && (
          <DropdownMenuItem onSelect={onDemote}>
            <MENU_ICONS.demote aria-hidden />
            Demote to Staff
          </DropdownMenuItem>
        )}
        {canTransfer && (
          <DropdownMenuItem onSelect={onTransfer}>
            <MENU_ICONS.transferOwnership aria-hidden />
            Transfer primary ownership…
          </DropdownMenuItem>
        )}
        {(canDeactivate || !active) && <DropdownMenuSeparator />}
        {canDeactivate && (
          <DropdownMenuItem onSelect={onDeactivate}>
            <MENU_ICONS.deactivate aria-hidden />
            Deactivate
          </DropdownMenuItem>
        )}
        {!active && (
          <DropdownMenuItem onSelect={onReactivate}>
            <MENU_ICONS.reactivate aria-hidden />
            Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">
      {n}
    </span>
  );
}
