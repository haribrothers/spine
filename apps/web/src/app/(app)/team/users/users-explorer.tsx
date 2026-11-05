"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ListFilter, Lock, MoreHorizontal, RefreshCw, Search, TriangleAlert, UserPlus, Users } from "lucide-react";
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
import { t, useT } from "../../../../lib/i18n";
import type { InvitationRow } from "../../../../lib/invitations";
import type { MemberRow } from "../../../../lib/members";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import { replaceQuery } from "../../../../lib/replace-query";
import { useToast } from "../../../../components/toast-host";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../../contacts/contacts-list-state";
import { ChangeMemberPasswordDialog } from "./change-member-password-dialog";
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
  { key: "person", header: t("team.users.columns.person"), width: "w-56" },
  { key: "role", header: t("team.users.columns.role"), width: "w-20" },
  { key: "teams", header: t("team.users.columns.teams"), width: "w-48" },
  { key: "lastActive", header: t("team.users.columns.lastActive"), width: "w-28" },
  { key: "joined", header: t("team.users.columns.joined"), width: "w-24" },
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
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersListState>(() => parseUsersState(new URLSearchParams(searchParams.toString())));
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [invites, setInvites] = useState<InvitationRow[] | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [businessName, setBusinessName] = useState(() => t("team.users.yourBusiness"));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<MemberRow | null>(null);
  const [viewing, setViewing] = useState<MemberRow | null>(null);
  const [changingRole, setChangingRole] = useState<MemberRow | null>(null);
  const [settingPassword, setSettingPassword] = useState<MemberRow | null>(null);
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
      if (mode === "first") setLoadError(err instanceof Error ? err.message : t("team.users.loadFailed"));
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
      setActionError(`${failure} ${err instanceof Error ? err.message : t("team.common.tryAgain")}`);
      return false;
    }
  }

  async function deactivate(member: MemberRow) {
    const ok = await confirm({
      title: t("team.users.deactivateConfirm.title", { name: member.name }),
      description: `${t("team.users.deactivateConfirm.description", { business: businessName })}${member.isDemo ? t("team.users.deactivateConfirm.demoNote") : ""}`,
      confirmLabel: t("team.users.deactivateConfirm.confirm"),
      cancelLabel: t("team.common.goBack"),
      danger: true,
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/deactivate`), [t("team.users.deactivateToast.title", { name: member.name }), t("team.users.deactivateToast.description")], t("team.users.deactivateFailed", { name: member.name }));
  }

  async function reactivate(member: MemberRow) {
    const ok = await confirm({
      title: t("team.users.reactivateConfirm.title", { name: member.name }),
      description: t("team.users.reactivateConfirm.description", { role: ROLE_LABELS[member.role] ?? member.role, business: businessName }),
      confirmLabel: t("team.users.reactivateConfirm.confirm"),
      cancelLabel: t("team.common.goBack"),
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/reactivate`), [t("team.users.reactivateToast.title", { name: member.name }), t("team.users.reactivateToast.description")], t("team.users.reactivateFailed", { name: member.name }));
  }

  async function promote(member: MemberRow) {
    // US-TEAM-16 (D-059): granting full access is confirmed first; a primary, not danger, action (D-058).
    const ok = await confirm({
      title: t("team.users.promoteConfirm.title", { name: member.name }),
      description: t("team.users.promoteConfirm.description", { business: businessName, name: member.name }),
      confirmLabel: t("team.users.promoteConfirm.confirm"),
      cancelLabel: t("team.common.cancel"),
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/promote`), [t("team.users.promoteToast.title", { name: member.name }), t("team.users.promoteToast.description")], t("team.users.promoteFailed", { name: member.name }));
  }

  async function demote(member: MemberRow) {
    const ok = await confirm({
      title: t("team.users.demoteConfirm.title", { name: member.name }),
      description: t("team.users.demoteConfirm.description"),
      confirmLabel: t("team.users.demoteConfirm.confirm"),
      cancelLabel: t("team.common.cancel"),
    });
    if (!ok) return;
    await act(() => apiClient.put(`/org/members/${member.id}/demote`), [t("team.users.isRole", { name: member.name, role: t("team.roles.staff") }), t("team.users.teamsDecide")], t("team.users.demoteFailed", { name: member.name }));
  }

  async function saveTeams(member: MemberRow, teamIds: string[]) {
    const updated = await apiClient.put<MemberRow>(`/org/members/${member.id}/teams`, { teamIds });
    setManaging(null);
    showToast(t("team.users.teamsSaved"), teamsSentence(member.name, updated.teams ?? []));
    void load();
  }

  async function changeRole(member: MemberRow, role: "staff" | "field", teamIds: string[]) {
    setChangingRole(null);
    await act(
      () => apiClient.put(`/org/members/${member.id}/role`, role === "staff" ? { role, teamIds } : { role }),
      [t("team.users.isRole", { name: member.name, role: role === "staff" ? t("team.roles.staff") : t("team.roles.field") }), role === "staff" ? t("team.users.teamsDecide") : t("team.users.fieldSees")],
      t("team.users.changeRoleFailed", { name: member.name }),
    );
  }

  function invited(result: InviteMembersResult) {
    void load();
    if (result.invited.length > 0) {
      showToast(
        result.invited.length === 1 ? t("team.users.inviteSentTo", { email: result.invited[0]!.email }) : t("team.users.invitesSent", { n: result.invited.length }),
        result.skipped.length > 0 ? t("team.users.invitesSkipped", { n: result.skipped.length }) : t("team.users.invitesAppear"),
      );
    }
  }

  async function copyLink(invite: InvitationRow) {
    if (!invite.acceptUrl) return;
    try {
      await navigator.clipboard.writeText(invite.acceptUrl);
      showToast(t("team.users.linkCopied"), t("team.users.linkCopiedDescription", { email: invite.email }));
    } catch {
      showToast(t("team.users.hereIsLink"), invite.acceptUrl);
    }
  }

  async function resend(invite: InvitationRow) {
    await act(() => apiClient.post(`/org/invitations/${invite.id}/resend`), [t("team.users.resentToast.title", { email: invite.email }), t("team.users.resentToast.description")], t("team.users.resendFailed", { email: invite.email }));
  }

  async function cancelInvite(invite: InvitationRow) {
    const ok = await confirm({
      title: t("team.users.cancelInviteConfirm.title"),
      description: t("team.users.cancelInviteConfirm.description", { email: invite.email }),
      confirmLabel: t("team.users.cancelInviteConfirm.confirm"),
      cancelLabel: t("team.users.cancelInviteConfirm.cancel"),
      danger: true,
    });
    if (!ok) return;
    await act(() => apiClient.delete(`/org/invitations/${invite.id}`), [t("team.users.cancelInviteToast.title"), t("team.users.cancelInviteToast.description", { email: invite.email })], t("team.users.cancelInviteFailed"));
  }

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
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-on-surface">{m.name}</span>
              {m.id === currentMemberId && <Badge className="bg-primary/10 text-primary">{t("team.users.badges.you")}</Badge>}
              {m.isPrimaryOwner && <Badge className="bg-paid-bg text-paid">{t("team.users.badges.primaryOwner")}</Badge>}
              {m.isDemo && <Badge className="bg-due-soon-bg text-due-soon">{t("team.common.demo")}</Badge>}
              {!m.isActive && <Badge>{t("team.users.badges.deactivated")}</Badge>}
            </span>
            <span className="truncate text-[12.5px] text-on-surface-muted">{m.email}</span>
          </span>
        </span>
      ),
      sortValue: (m) => m.name.toLowerCase(),
    },
    {
      key: "role",
      header: t("team.users.columns.role"),
      render: (m) => ROLE_LABELS[m.role] ?? m.role,
      sortValue: (m) => m.role,
    },
    {
      key: "teams",
      header: t("team.users.columns.teams"),
      render: (m) =>
        m.role === "owner" ? (
          <span className="text-on-surface-muted">{t("team.users.everything")}</span>
        ) : m.role === "field" ? (
          <span className="text-on-surface-muted">{t("team.users.fieldAccess")}</span>
        ) : (m.teams?.length ?? 0) === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-due-soon">
            <TriangleAlert size={14} aria-hidden />
            {t("team.users.noTeamWarning")}
          </span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {m.teams!.map((team) => (
              <Link key={team.id} href={`/team/teams/${team.id}`} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface hover:border-primary hover:text-primary">
                {team.name}
              </Link>
            ))}
          </span>
        ),
      sortValue: (m) => (m.teams ?? []).map((team) => team.name).join(", "),
    },
    {
      key: "lastActive",
      header: t("team.users.columns.lastActive"),
      render: (m) => <span className={cn("whitespace-nowrap", !m.lastActiveAt && "text-on-surface-muted")}>{lastActiveLabel(m.lastActiveAt, now)}</span>,
      sortValue: (m) => m.lastActiveAt ?? "",
    },
    {
      key: "joined",
      header: t("team.users.columns.joined"),
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
            onChangePassword={() => setSettingPassword(m)}
          />
        </div>
      ),
    },
  ];

  const inviteColumns: TableColumn<InvitationRow>[] = [
    {
      key: "email",
      header: t("team.users.columns.email"),
      render: (i) => <span className="font-semibold text-on-surface">{i.email}</span>,
      sortValue: (i) => i.email,
    },
    {
      key: "role",
      header: t("team.users.columns.role"),
      render: (i) => ROLE_LABELS[i.role] ?? i.role,
      sortValue: (i) => i.role,
    },
    {
      key: "teams",
      header: t("team.users.columns.teamsOnJoining"),
      render: (i) =>
        i.teams && i.teams.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {i.teams.map((team) => (
              <span key={team.id} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[12px] font-medium text-on-surface">
                {team.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-on-surface-muted">—</span>
        ),
    },
    {
      key: "invited",
      header: t("team.users.columns.invited"),
      render: (i) => <span className="whitespace-nowrap">{[i.inviterName, i.createdAt ? shortDate(i.createdAt, now) : null].filter(Boolean).join(" · ")}</span>,
      sortValue: (i) => i.createdAt ?? "",
    },
    {
      key: "expires",
      header: t("team.users.columns.expires"),
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
                aria-label={t("team.users.inviteActionsFor", { email: i.email })}
                className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {!isExpired(i, now) && (
                <DropdownMenuItem onSelect={() => void copyLink(i)}>
                  <MENU_ICONS.copyLink aria-hidden />
                  {t("team.users.copyInviteLink")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void resend(i)}>
                <MENU_ICONS.send aria-hidden />
                {t("team.users.resend")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void cancelInvite(i)}>
                <MENU_ICONS.cancel aria-hidden />
                {t("team.users.cancelInvite")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: t("team.common.breadcrumbTeam") }, { label: t("team.users.title") }]}
      title={t("team.users.title")}
      description={t("team.users.description", { business: businessName })}
      action={
        <Button onClick={() => setInviting(true)}>
          <UserPlus size={14} aria-hidden />
          {t("team.users.invitePeople")}
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
        placeholder={onInvites ? t("team.users.searchEmails") : t("team.users.searchNamesOrEmails")}
        aria-label={onInvites ? t("team.users.searchEmails") : t("team.users.searchNamesOrEmails")}
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        className="pl-9"
      />
    </div>
  );
  const filtered = Boolean(state.q.trim() || state.role || state.noTeam);
  const clear = (
    <Button variant="secondary" onClick={() => update({ role: null, noTeam: false, q: "" })}>
      {t("team.common.clearFilters")}
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
          <TabsTrigger value="active" className="group" aria-label={members ? t("team.users.tabs.activeCount", { n: activeCount }) : t("team.users.tabs.active")}>
            {t("team.users.tabs.active")}
            {members && <Count n={activeCount} />}
          </TabsTrigger>
          <TabsTrigger value="deactivated" className="group" aria-label={members ? t("team.users.tabs.deactivatedCount", { n: deactivatedCount }) : t("team.users.tabs.deactivated")}>
            {t("team.users.tabs.deactivated")}
            {members && <Count n={deactivatedCount} />}
          </TabsTrigger>
          <TabsTrigger value="invites" className="group" aria-label={invites ? t("team.users.tabs.invitesCount", { n: invites.length }) : t("team.users.tabs.invites")}>
            {t("team.users.tabs.invites")}
            {invites && <Count n={invites.length} />}
          </TabsTrigger>
        </TabsList>

        {/* The tab's panel holds the cards, filters and list, so the active tab controls something real (WCAG 4.1.2). */}
        <TabsContent value={state.tab} className="flex flex-col gap-6 pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="users-cards">
            <StatCard label={t("team.users.cards.people")} value={totals ? String(totals.people) : "—"} trend={totals ? { direction: "neutral", label: totals.peopleLabel } : undefined} className="h-full" />
            <button
              type="button"
              aria-pressed={state.noTeam}
              aria-label={t("team.users.cards.showNoTeamOnly")}
              onClick={() => update({ noTeam: !state.noTeam, tab: "active" })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label={t("team.users.cards.staffWithoutTeam")}
                value={totals ? String(totals.noTeam) : "—"}
                tone={totals && totals.noTeam > 0 ? "warning" : "default"}
                trend={{
                  direction: "neutral",
                  label: state.noTeam ? t("team.common.showingThese") : totals && totals.noTeam > 0 ? t("team.users.cards.cantOpenYet") : t("team.common.everyoneCanWork"),
                }}
                className={cn("h-full transition-colors hover:border-border-strong", state.noTeam && "border-primary bg-info-bg/60 ring-1 ring-primary")}
              />
              <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", state.noTeam ? "text-primary" : "text-on-surface-muted")} />
            </button>
            <button
              type="button"
              aria-label={t("team.users.openInvites")}
              onClick={() => update({ tab: "invites", noTeam: false })}
              className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <StatCard
                label={t("team.users.cards.pendingInvites")}
                value={totals ? String(totals.invites) : "—"}
                trend={totals ? { direction: "neutral", label: totals.invitesLabel } : undefined}
                className="h-full transition-colors hover:border-border-strong"
              />
              <ArrowUpRight size={14} aria-hidden className="absolute right-4 top-4 text-on-surface-muted" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={state.role ?? ALL_ROLES} onValueChange={(v) => update({ role: v === ALL_ROLES ? null : (v as UsersRole) })}>
              <SelectTrigger aria-label={t("team.users.filterByRole")} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>{t("team.users.allRoles")}</SelectItem>
                <SelectItem value="owner">{t("team.roles.owner")}</SelectItem>
                <SelectItem value="staff">{t("team.roles.staff")}</SelectItem>
                <SelectItem value="field">{t("team.roles.field")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {updatedAt !== null && (
                <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="users-updated">
                  {refreshing ? t("team.common.updating") : updatedLabel(updatedAt, now)}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label={t("team.common.refreshList")} aria-busy={refreshing} disabled={refreshing} onClick={() => void load()}>
                    <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("team.common.refreshList")}</TooltipContent>
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
                    <EmptyState icon={<Users />} title={t("team.users.empty.invitesFilteredTitle")} description={t("team.users.empty.invitesFilteredDescription")} action={clear} />
                  ) : (
                    <EmptyState
                      icon={<UserPlus />}
                      title={t("team.users.empty.invitesTitle")}
                      description={t("team.users.empty.invitesDescription")}
                      action={
                        <Button onClick={() => setInviting(true)}>
                          <UserPlus size={14} aria-hidden />
                          {t("team.users.invitePeople")}
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
                  <EmptyState icon={<Users />} title={t("team.users.empty.deactivatedTitle")} description={t("team.users.empty.deactivatedDescription")} />
                ) : state.noTeam && !state.q.trim() && !state.role ? (
                  <EmptyState icon={<Users />} title={t("team.users.empty.noTeamTitle")} description={t("team.users.empty.noTeamDescription")} action={clear} />
                ) : (
                  <EmptyState icon={<Users />} title={t("team.users.empty.filteredTitle")} description={t("team.users.empty.filteredDescription")} action={clear} />
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
      <ChangeMemberPasswordDialog
        member={settingPassword}
        onOpenChange={(open) => !open && setSettingPassword(null)}
        onChanged={(m) => {
          setSettingPassword(null);
          showToast(t("team.users.passwordChangedToast.title", { name: m.name }), t("team.users.passwordChangedToast.description"));
          void load();
        }}
      />
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
            [t("team.users.transferToast.title"), t("team.users.transferToast.description", { name: to?.name ?? t("team.users.transferToast.they") })],
            t("team.users.transferFailed"),
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
  onChangePassword,
}: {
  member: MemberRow;
  isMe: boolean;
  canTransfer: boolean;
  onChangePassword: () => void;
  onView: () => void;
  onManageTeams: () => void;
  onChangeRole: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onTransfer: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const t = useT();
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
          aria-label={t("team.common.actionsFor", { name: member.name })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={onView}>
          <MENU_ICONS.view aria-hidden />
          {t("team.common.whatTheyCanOpen")}
        </DropdownMenuItem>
        {active && staff && (
          <DropdownMenuItem onSelect={onManageTeams}>
            <MENU_ICONS.manageTeams aria-hidden />
            {t("team.common.manageTeams")}
          </DropdownMenuItem>
        )}
        {active && (staff || field) && (
          <DropdownMenuItem onSelect={onChangeRole}>
            <MENU_ICONS.changeRole aria-hidden />
            {t("team.common.changeToRole", { role: staff ? t("team.roles.field") : t("team.roles.staff") })}
          </DropdownMenuItem>
        )}
        {active && staff && (
          <DropdownMenuItem onSelect={onPromote}>
            <MENU_ICONS.promote aria-hidden />
            {t("team.users.menu.promote")}
          </DropdownMenuItem>
        )}
        {active && canDemote && (
          <DropdownMenuItem onSelect={onDemote}>
            <MENU_ICONS.demote aria-hidden />
            {t("team.users.menu.demote")}
          </DropdownMenuItem>
        )}
        {active && (staff || field) && !isMe && (
          <DropdownMenuItem onSelect={onChangePassword}>
            <MENU_ICONS.changePassword aria-hidden />
            {t("team.users.menu.changePassword")}
          </DropdownMenuItem>
        )}
        {member.isPrimaryOwner && !isMe && (
          <>
            <DropdownMenuSeparator />
            {/* US-TEAM-24 (D-233): nobody sets the Primary Owner's password. */}
            <p className="flex max-w-64 items-start gap-1.5 px-2 py-1.5 text-[12px] text-on-surface-muted" data-testid="primary-owner-password-note">
              <Lock size={13} aria-hidden className="mt-0.5 shrink-0" />
              {t("team.users.menu.primaryOwnerPasswordNote", { first: member.name.split(" ")[0] ?? "" })}
            </p>
          </>
        )}
        {canTransfer && (
          <DropdownMenuItem onSelect={onTransfer}>
            <MENU_ICONS.transferOwnership aria-hidden />
            {t("team.users.menu.transfer")}
          </DropdownMenuItem>
        )}
        {(canDeactivate || !active) && <DropdownMenuSeparator />}
        {canDeactivate && (
          <DropdownMenuItem onSelect={onDeactivate}>
            <MENU_ICONS.deactivate aria-hidden />
            {t("team.users.menu.deactivate")}
          </DropdownMenuItem>
        )}
        {!active && (
          <DropdownMenuItem onSelect={onReactivate}>
            <MENU_ICONS.reactivate aria-hidden />
            {t("team.users.menu.reactivate")}
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
