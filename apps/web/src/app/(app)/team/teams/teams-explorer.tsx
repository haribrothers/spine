"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MoreHorizontal, Plus, Search, Shield } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
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
  StatCard,
  TableSkeleton,
  cn,
  useConfirm,
  type TableColumn,
} from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import { t, useT } from "../../../../lib/i18n";
import type { MemberRow } from "../../../../lib/members";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import { useModules } from "../../../../lib/modules-context";
import { replaceQuery } from "../../../../lib/replace-query";
import type { TeamSummary } from "../../../../lib/teams";
import { useToast } from "../../../../components/toast-host";
import { initials } from "../users/users-list-state";
import { TeamDialog, type TeamDialogMode } from "./team-dialog";
import { filterTeams, leftWithoutTeam, peopleLabel, permissionCount, sectionsOpened, teamsTotals } from "./teams-state";

const COLUMNS = [
  { key: "name", header: t("team.teams.columns.team"), width: "w-56" },
  { key: "members", header: t("team.teams.columns.members"), width: "w-40" },
  { key: "works", header: t("team.teams.columns.worksIn"), width: "w-32" },
  { key: "permissions", header: t("team.teams.columns.permissions"), width: "w-32" },
];

/** A small bar under a count, from tokens. */
function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <span className="flex w-36 flex-col gap-1 text-[12.5px] text-on-surface">
      {label}
      <span className="h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }} />
      </span>
    </span>
  );
}

/**
 * US-TEAM-25 to US-TEAM-26 (D-234) — `TeamsListRefined`: every Team on the
 * list layout every refined list shares — "Create Team" in the header, the
 * cards (Staff on no Team opens Users filtered to them) and the search,
 * kept in the address. Each row says who is on the Team and what it adds
 * up to; its menu opens, renames, duplicates or deletes (asking first and
 * naming anyone it would leave on no Team).
 */
export function TeamsExplorer() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { modules } = useModules();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TeamDialogMode | null>(null);
  const showToast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [teamRows, memberRows] = await Promise.all([apiClient.get<TeamSummary[]>("/org/teams"), apiClient.get<MemberRow[]>("/org/members")]);
      setTeams(teamRows);
      setMembers(memberRows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("team.teams.loadFailed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => (teams ? filterTeams(teams, q) : null), [teams, q]);
  const totals = useMemo(() => (teams ? teamsTotals(teams, members) : null), [teams, members]);

  function search(value: string) {
    setQ(value);
    replaceQuery(pathname, value.trim() ? `q=${encodeURIComponent(value.trim())}` : "");
  }

  async function remove(team: TeamSummary) {
    const stranded = leftWithoutTeam(team.id, team.members.map((m) => m.memberId), teams ?? []).map((id) => team.members.find((m) => m.memberId === id)!.name);
    const ok = await confirm({
      title: t("team.teams.deleteConfirm.title", { name: team.name }),
      description: (
        <>
          {team.members.length ? t("team.teams.deleteConfirm.membersLose", { count: team.members.length }) : t("team.teams.deleteConfirm.noOne")}
          {t("team.teams.deleteConfirm.permissionsGo")}
          {stranded.length > 0 && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface" data-testid="delete-team-stranded">
              {t("team.teams.deleteConfirm.stranded", { names: stranded.join(", ") })}
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
    setActionError(null);
    try {
      await apiClient.delete(`/org/teams/${team.id}`);
      showToast(t("team.teams.deletedToast.title", { name: team.name }), team.members.length ? t("team.teams.deletedToast.lost", { count: team.members.length }) : t("team.teams.deletedToast.noOne"));
      void load();
    } catch (err) {
      setActionError(`${t("team.teams.deleteFailed", { name: team.name })} ${err instanceof Error ? err.message : t("team.common.tryAgain")}`);
    }
  }

  function saved(team: TeamSummary, mode: TeamDialogMode) {
    setDialog(null);
    if (mode.kind === "rename") {
      showToast(t("team.teams.savedToast.title"), t("team.teams.savedToast.description", { name: team.name }));
      void load();
    } else {
      showToast(t("team.teams.createdToast.title", { name: team.name }), t("team.teams.createdToast.description"));
      router.push(`/team/teams/${team.id}?tab=permissions`);
    }
  }

  const columns: TableColumn<TeamSummary>[] = [
    {
      key: "name",
      header: t("team.teams.columns.team"),
      render: (team) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href={`/team/teams/${team.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
              {team.name}
            </Link>
            {team.isDefault && <Badge className="bg-paid-bg text-paid">{t("team.common.default")}</Badge>}
            {team.isDemo && <Badge className="bg-due-soon-bg text-due-soon">{t("team.common.demo")}</Badge>}
          </span>
          {team.description && <span className="truncate text-[12.5px] text-on-surface-muted">{team.description}</span>}
        </span>
      ),
      sortValue: (team) => team.name.toLowerCase(),
    },
    {
      key: "members",
      header: t("team.teams.columns.members"),
      render: (team) =>
        team.members.length === 0 ? (
          <span className="text-on-surface-muted">{t("team.teams.noOneYet")}</span>
        ) : (
          <span className="flex items-center gap-2" title={team.members.map((m) => m.name).join(", ")}>
            <span className="flex" aria-hidden>
              {team.members.slice(0, 4).map((m, i) => (
                <span key={m.memberId} className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-surface bg-primary text-[10.5px] font-semibold text-on-primary", i > 0 && "-ml-1.5")}>
                  {initials(m.name)}
                </span>
              ))}
            </span>
            <span className="text-[12.5px] text-on-surface-muted">{peopleLabel(team.members.length)}</span>
          </span>
        ),
      sortValue: (team) => team.members.length,
    },
    {
      key: "works",
      header: t("team.teams.columns.worksIn"),
      render: (team) => {
        const s = sectionsOpened(team.granted, modules);
        return <Meter value={s.works} total={s.total} label={t("team.teams.sectionsCount", { works: s.works, total: s.total })} />;
      },
      sortValue: (team) => sectionsOpened(team.granted, modules).works,
    },
    {
      key: "permissions",
      header: t("team.teams.columns.permissions"),
      render: (team) => {
        const p = permissionCount(team.granted, modules);
        return <Meter value={p.granted} total={p.total} label={t("team.common.ofTotal", { granted: p.granted, total: p.total })} />;
      },
      sortValue: (team) => team.granted.length,
    },
    {
      key: "actions",
      header: "",
      render: (team) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={t("team.common.actionsFor", { name: team.name })} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface">
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => router.push(`/team/teams/${team.id}`)}>
                <MENU_ICONS.open aria-hidden />
                {t("team.teams.open")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "rename", team })}>
                <MENU_ICONS.edit aria-hidden />
                {t("team.common.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "create", from: team })}>
                <MENU_ICONS.duplicate aria-hidden />
                {t("team.common.duplicate")}
              </DropdownMenuItem>
              {!team.isDefault && (teams?.length ?? 0) > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void remove(team)}>
                    <MENU_ICONS.delete aria-hidden />
                    {t("team.common.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const header = (
    <AppShellHeader
      breadcrumb={[{ label: t("team.common.breadcrumbTeam") }, { label: t("team.teams.title") }]}
      title={t("team.teams.title")}
      description={t("team.teams.description")}
      action={
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus size={14} aria-hidden />
          {t("team.teams.createTeam")}
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

  const searchBox = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("team.teams.searchTeams")} aria-label={t("team.teams.searchTeams")} value={q} onChange={(e) => search(e.target.value)} className="pl-9" />
    </div>
  );

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="teams-cards">
          <StatCard label={t("team.teams.title")} value={totals ? String(totals.teams) : "—"} trend={totals ? { direction: "neutral", label: totals.teamsLabel } : undefined} className="h-full" />
          <Link href="/team/users?card=no-team" aria-label={t("team.teams.cards.noTeamAria")} className="relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <StatCard
              label={t("team.teams.cards.noTeam")}
              value={totals ? String(totals.noTeam) : "—"}
              tone={totals && totals.noTeam > 0 ? "warning" : "default"}
              trend={totals ? { direction: "neutral", label: totals.noTeamLabel } : undefined}
              className="h-full transition-colors hover:border-border-strong"
            />
            <ArrowUpRight size={14} aria-hidden className="absolute right-4 top-4 text-on-surface-muted" />
          </Link>
          <StatCard label={t("team.teams.cards.several")} value={totals ? String(totals.several) : "—"} trend={{ direction: "neutral", label: t("team.teams.cards.severalTrend") }} className="h-full" />
        </div>

        {actionError && (
          <Alert variant="critical">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {!rows ? (
          <TableSkeleton columns={COLUMNS} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex">{searchBox}</div>
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={<Shield />}
                title={t("team.teams.empty.title")}
                description={t("team.teams.empty.description")}
                action={
                  <Button variant="secondary" onClick={() => search("")}>
                    {t("team.teams.empty.clearSearch")}
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div data-testid="teams-table">
            <DataTable columns={columns} data={rows} rowKey={(team) => team.id} toolbarStart={searchBox} />
          </div>
        )}
      </div>
      <TeamDialog mode={dialog} teams={teams ?? []} onOpenChange={(open) => !open && setDialog(null)} onSaved={saved} />
      {confirmDialog}
    </>
  );
}
