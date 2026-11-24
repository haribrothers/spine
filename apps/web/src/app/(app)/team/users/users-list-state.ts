import type { InvitationRow } from "../../../../lib/invitations";
import type { MemberRow } from "../../../../lib/members";
import { t } from "../../../../lib/i18n";
import { orgLocaleTag } from "../../../../lib/money";

export type UsersTab = "active" | "deactivated" | "invites";
export type UsersRole = "owner" | "staff" | "field";

/** US-TEAM-19 (D-210, D-232) — what Users shows, kept in the address. */
export interface UsersListState {
  tab: UsersTab;
  role: UsersRole | null;
  /** The Staff without a Team card: only Staff on no Team. */
  noTeam: boolean;
  q: string;
}

const ROLES: readonly UsersRole[] = ["owner", "staff", "field"];
export const ROLE_LABELS: Record<string, string> = { owner: t("team.roles.owner"), staff: t("team.roles.staff"), field: t("team.roles.field") };

/** `?tab=invites&role=staff&card=no-team&q=`. */
export function parseUsersState(params: URLSearchParams): UsersListState {
  const tab = params.get("tab");
  const role = params.get("role");
  return {
    tab: tab === "deactivated" || tab === "invites" ? tab : "active",
    role: role && (ROLES as readonly string[]).includes(role) ? (role as UsersRole) : null,
    noTeam: params.get("card") === "no-team",
    q: params.get("q") ?? "",
  };
}

/** The query for a state; defaults are left out, so `/team/users` is everyone active. */
export function usersQuery(state: UsersListState): string {
  const params = new URLSearchParams();
  if (state.tab !== "active") params.set("tab", state.tab);
  if (state.role) params.set("role", state.role);
  if (state.noTeam) params.set("card", "no-team");
  if (state.q.trim()) params.set("q", state.q.trim());
  return params.toString();
}

/** A Staff member on no Team can't open anything (US-TEAM-20). */
export const isWithoutTeam = (m: MemberRow) => m.role === "staff" && m.isActive && (m.teams?.length ?? 0) === 0;

/** The people on the tab, of the role, on no Team when that card is pressed, whose name or email contains the search. */
export function filterMembers(rows: MemberRow[], state: UsersListState): MemberRow[] {
  const q = state.q.trim().toLowerCase();
  return rows.filter(
    (m) =>
      (state.tab === "deactivated" ? !m.isActive : m.isActive) &&
      (!state.role || m.role === state.role) &&
      (!state.noTeam || isWithoutTeam(m)) &&
      (!q || `${m.name} ${m.email}`.toLowerCase().includes(q)),
  );
}

/** Invites of the role whose email contains the search. */
export function filterInvites(rows: InvitationRow[], state: UsersListState): InvitationRow[] {
  const q = state.q.trim().toLowerCase();
  return rows.filter((i) => (!state.role || i.role === state.role) && (!q || i.email.toLowerCase().includes(q)));
}

export const isExpired = (invite: Pick<InvitationRow, "expiresAt">, now = Date.now()) => new Date(invite.expiresAt).getTime() <= now;

/** The cards' figures: People (by role), Staff without a Team and Pending invites (with how many expired). */
export function usersTotals(members: MemberRow[], invites: InvitationRow[], now = Date.now()) {
  const active = members.filter((m) => m.isActive);
  const count = (role: string) => active.filter((m) => m.role === role).length;
  const expired = invites.filter((i) => isExpired(i, now)).length;
  return {
    people: active.length,
    peopleLabel: t("team.users.peopleLabel", { count: count("owner"), staff: count("staff"), field: count("field") }),
    noTeam: active.filter(isWithoutTeam).length,
    invites: invites.length,
    invitesLabel: expired > 0 ? t("team.users.invitesExpired", { n: expired }) : t("team.users.openInvites"),
  };
}

const DAY = 86_400_000;

/** "12 Oct" this year, "12 Oct 2025" before — in the business's format. */
export function shortDate(value: string | Date, now = Date.now()): string {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago", then the date; "Never signed in" without a session. */
export function lastActiveLabel(value: string | null | undefined, now = Date.now()): string {
  if (!value) return t("team.users.lastActive.never");
  const ms = now - new Date(value).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t("team.users.lastActive.justNow");
  if (minutes < 60) return t("team.users.lastActive.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("team.users.lastActive.hoursAgo", { count: hours });
  const days = Math.floor(ms / DAY);
  if (days === 1) return t("team.users.lastActive.yesterday");
  if (days < 7) return t("team.users.lastActive.daysAgo", { days });
  return shortDate(value, now);
}

/** "Expires in 5 days", "Expires tomorrow", "Expires today" or "Expired" — by calendar day, so a new 7-day invite reads 7. */
export function expiresLabel(expiresAt: string, now = Date.now()): string {
  const expires = new Date(expiresAt);
  if (expires.getTime() <= now) return t("team.users.expires.expired");
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(expires) - midnight(new Date(now))) / DAY);
  if (days === 0) return t("team.users.expires.today");
  if (days === 1) return t("team.users.expires.tomorrow");
  return t("team.users.expires.inDays", { days });
}

/** "Sarah Mendes is on General Staff and Accounts", or "… is on no Team — they can't open anything". */
export function teamsSentence(name: string, teams: { name: string }[]): string {
  if (teams.length === 0) return t("team.users.teamsSentence.noTeam", { name });
  const names = teams.map((team) => team.name);
  const list = names.length === 1 ? names[0]! : t("team.common.andList", { items: names.slice(0, -1).join(", "), last: names[names.length - 1]! });
  return t("team.users.teamsSentence.onTeams", { name, list });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
