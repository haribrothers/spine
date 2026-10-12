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
  { key: "name", header: "Team", width: "w-56" },
  { key: "members", header: "Members", width: "w-40" },
  { key: "works", header: "Works in", width: "w-32" },
  { key: "permissions", header: "Permissions", width: "w-32" },
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
      setLoadError(err instanceof Error ? err.message : "Couldn't load your Teams. Refresh to try again.");
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
      title: `Delete ${team.name}?`,
      description: (
        <>
          {team.members.length ? `Its ${peopleLabel(team.members.length)} ${team.members.length === 1 ? "loses" : "lose"} what it allowed.` : "No one is on it."} Its permissions and history go; nobody&apos;s login does.
          {stranded.length > 0 && (
            <span className="mt-2 block rounded-md bg-due-soon-bg px-3 py-2 text-on-surface" data-testid="delete-team-stranded">
              {stranded.length === 1 ? `${stranded[0]} will be on no Team` : `${stranded.join(", ")} will be on no Team`} — they can&apos;t open anything until you add them to one.
            </span>
          )}
        </>
      ),
      confirmLabel: "Delete Team",
      cancelLabel: "Go back",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.delete(`/org/teams/${team.id}`);
      showToast(`${team.name} deleted`, team.members.length ? `${peopleLabel(team.members.length)} lost what it allowed.` : "No one was on it.");
      void load();
    } catch (err) {
      setActionError(`Couldn't delete ${team.name}. ${err instanceof Error ? err.message : "Try again."}`);
    }
  }

  function saved(team: TeamSummary, mode: TeamDialogMode) {
    setDialog(null);
    if (mode.kind === "rename") {
      showToast("Team saved", `${team.name} is up to date.`);
      void load();
    } else {
      showToast(`${team.name} created`, "Check what it allows, then add people.");
      router.push(`/team/teams/${team.id}?tab=permissions`);
    }
  }

  const columns: TableColumn<TeamSummary>[] = [
    {
      key: "name",
      header: "Team",
      render: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex flex-wrap items-center gap-1.5">
            <Link href={`/team/teams/${t.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
              {t.name}
            </Link>
            {t.isDefault && <Badge className="bg-paid-bg text-paid">Default</Badge>}
            {t.isDemo && <Badge className="bg-due-soon-bg text-due-soon">Demo</Badge>}
          </span>
          {t.description && <span className="truncate text-[12.5px] text-on-surface-muted">{t.description}</span>}
        </span>
      ),
      sortValue: (t) => t.name.toLowerCase(),
    },
    {
      key: "members",
      header: "Members",
      render: (t) =>
        t.members.length === 0 ? (
          <span className="text-on-surface-muted">No one yet</span>
        ) : (
          <span className="flex items-center gap-2" title={t.members.map((m) => m.name).join(", ")}>
            <span className="flex" aria-hidden>
              {t.members.slice(0, 4).map((m, i) => (
                <span key={m.memberId} className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-surface bg-primary text-[10.5px] font-semibold text-on-primary", i > 0 && "-ml-1.5")}>
                  {initials(m.name)}
                </span>
              ))}
            </span>
            <span className="text-[12.5px] text-on-surface-muted">{peopleLabel(t.members.length)}</span>
          </span>
        ),
      sortValue: (t) => t.members.length,
    },
    {
      key: "works",
      header: "Works in",
      render: (t) => {
        const s = sectionsOpened(t.granted, modules);
        return <Meter value={s.works} total={s.total} label={`${s.works} of ${s.total} sections`} />;
      },
      sortValue: (t) => sectionsOpened(t.granted, modules).works,
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (t) => {
        const p = permissionCount(t.granted, modules);
        return <Meter value={p.granted} total={p.total} label={`${p.granted} of ${p.total}`} />;
      },
      sortValue: (t) => t.granted.length,
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Actions for ${t.name}`} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface">
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => router.push(`/team/teams/${t.id}`)}>
                <MENU_ICONS.open aria-hidden />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "rename", team: t })}>
                <MENU_ICONS.edit aria-hidden />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "create", from: t })}>
                <MENU_ICONS.duplicate aria-hidden />
                Duplicate
              </DropdownMenuItem>
              {!t.isDefault && (teams?.length ?? 0) > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void remove(t)}>
                    <MENU_ICONS.delete aria-hidden />
                    Delete
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
      breadcrumb={[{ label: "Team" }, { label: "Teams" }]}
      title="Teams"
      description="What each group of Staff can open and do. Someone on several Teams gets everything any of them allows."
      action={
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus size={14} aria-hidden />
          Create Team
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
      <Input type="search" placeholder="Search Teams" aria-label="Search Teams" value={q} onChange={(e) => search(e.target.value)} className="pl-9" />
    </div>
  );

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="teams-cards">
          <StatCard label="Teams" value={totals ? String(totals.teams) : "—"} trend={totals ? { direction: "neutral", label: totals.teamsLabel } : undefined} className="h-full" />
          <Link href="/team/users?card=no-team" aria-label="Staff on no Team — open in Users" className="relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <StatCard
              label="Staff on no Team"
              value={totals ? String(totals.noTeam) : "—"}
              tone={totals && totals.noTeam > 0 ? "warning" : "default"}
              trend={totals ? { direction: "neutral", label: totals.noTeamLabel } : undefined}
              className="h-full transition-colors hover:border-border-strong"
            />
            <ArrowUpRight size={14} aria-hidden className="absolute right-4 top-4 text-on-surface-muted" />
          </Link>
          <StatCard label="Staff on several Teams" value={totals ? String(totals.several) : "—"} trend={{ direction: "neutral", label: "they get everything any allows" }} className="h-full" />
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
                title="No Teams match"
                description="Clear the search to see every Team."
                action={
                  <Button variant="secondary" onClick={() => search("")}>
                    Clear search
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div data-testid="teams-table">
            <DataTable columns={columns} data={rows} rowKey={(t) => t.id} toolbarStart={searchBox} />
          </div>
        )}
      </div>
      <TeamDialog mode={dialog} teams={teams ?? []} onOpenChange={(open) => !open && setDialog(null)} onSaved={saved} />
      {confirmDialog}
    </>
  );
}
