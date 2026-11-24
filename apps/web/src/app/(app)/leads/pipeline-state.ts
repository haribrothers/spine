import type { Lead } from "../contacts/types";
import { t } from "../../../lib/i18n";

/** The board's sort orders (S-01.5). */
export type SortKey = "value-desc" | "value-asc" | "newest" | "oldest" | "title";

export const SORT_LABELS: Record<SortKey, string> = {
  "value-desc": t("leads.sort.valueDesc"),
  "value-asc": t("leads.sort.valueAsc"),
  newest: t("leads.sort.newest"),
  oldest: t("leads.sort.oldest"),
  title: t("leads.sort.title"),
};

export const SORTERS: Record<SortKey, (a: Lead, b: Lead) => number> = {
  "value-desc": (a, b) => Number(b.valueAmount) - Number(a.valueAmount),
  "value-asc": (a, b) => Number(a.valueAmount) - Number(b.valueAmount),
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  title: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
};

/** Closed columns list the most recently closed first (US-CRM-24). */
export const byClosedNewest = (a: Lead, b: Lead) => new Date(b.stageChangedAt).getTime() - new Date(a.stageChangedAt).getTime();

/** US-CRM-28 (D-210, D-211) — what the board shows, kept in the address. */
export interface PipelineState {
  q: string;
  /** Stage ids; empty means every stage. */
  stages: string[];
  /** "" every owner, "me", "unassigned" or a member's user id. */
  owner: string;
  /** "" every source, else one source in use. */
  source: string;
  sort: SortKey;
  /** Only leads with a follow-up past due (the summary strip's "Overdue follow-ups"). */
  overdue: boolean;
}

export const DEFAULT_SORT: SortKey = "newest";

export function parsePipelineState(params: URLSearchParams): PipelineState {
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    stages: params.getAll("stage"),
    owner: params.get("owner") ?? "",
    source: params.get("source") ?? "",
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : DEFAULT_SORT,
    overdue: params.get("overdue") === "1",
  };
}

/** The query string for a state; defaults are left out (`/leads` is the whole board). */
export function pipelineQuery(state: PipelineState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const s of state.stages) params.append("stage", s);
  if (state.owner) params.set("owner", state.owner);
  if (state.source) params.set("source", state.source);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.overdue) params.set("overdue", "1");
  return params.toString();
}

/** Any filter that can hide leads (sort aside). */
export function hasPipelineFilters(state: PipelineState): boolean {
  return Boolean(state.q.trim() || state.stages.length || state.owner || state.source || state.overdue);
}

const DAY = 86_400_000;

/** Whole days since the lead last changed stage ("12 days in stage"). */
export function daysInStage(lead: Lead, now: number): number {
  return Math.max(0, Math.floor((now - new Date(lead.stageChangedAt).getTime()) / DAY));
}

export function daysLabel(days: number): string {
  return t("leads.daysInStage", { count: days });
}

/** Its next follow-up is past due. */
export function isOverdue(lead: Lead, now: number): boolean {
  return lead.nextFollowUp !== null && new Date(lead.nextFollowUp.dueAt).getTime() < now;
}

/** A lead goes cold after this many days with no activity and no change (D-211). */
export const COLD_AFTER_DAYS = 14;

/** Days an open lead has gone with no activity and no change, when that's 14 or more; null otherwise. */
export function coldDays(lead: Lead, now: number): number | null {
  if (lead.stageKind !== "open") return null;
  const last = Math.max(new Date(lead.updatedAt).getTime(), lead.lastActivityAt ? new Date(lead.lastActivityAt).getTime() : 0);
  const days = Math.floor((now - last) / DAY);
  return days >= COLD_AFTER_DAYS ? days : null;
}

/** Closed (won or lost) within the last `days` days. */
export function closedWithin(lead: Lead, days: number, now: number): boolean {
  return lead.stageKind !== "open" && now - new Date(lead.stageChangedAt).getTime() <= days * DAY;
}

/** How long the slim Won and Lost columns look back (D-211). */
export const CLOSED_WINDOW_DAYS = 30;
/** How far back the win rate looks (D-211). */
export const WIN_RATE_DAYS = 90;

/** Whether a lead passes the filters (the stage filter is applied by the column, not here). */
export function matchesPipeline(lead: Lead, contactName: string, state: PipelineState, me: string | null, now: number): boolean {
  if (state.owner === "me" && (!me || lead.ownerUserId !== me)) return false;
  if (state.owner === "unassigned" && lead.ownerUserId !== null) return false;
  if (state.owner && state.owner !== "me" && state.owner !== "unassigned" && lead.ownerUserId !== state.owner) return false;
  if (state.source && lead.source !== state.source) return false;
  if (state.overdue && (lead.stageKind !== "open" || !isOverdue(lead, now))) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  return (lead.title ?? "").toLowerCase().includes(q) || contactName.toLowerCase().includes(q);
}

/** Totals by currency, in first-seen order. */
export function totalsByCurrency(leads: Lead[]): [string, bigint][] {
  const totals = new Map<string, bigint>();
  for (const lead of leads) totals.set(lead.valueCurrency, (totals.get(lead.valueCurrency) ?? 0n) + BigInt(lead.valueAmount));
  return [...totals.entries()];
}

export interface PipelineSummary {
  open: { count: number; totals: [string, bigint][] };
  wonThisMonth: { count: number; totals: [string, bigint][] };
  /** Won and lost closed in the last 90 days; `rate` is null when none closed. */
  winRate: { won: number; closed: number; rate: number | null };
  overdue: number;
}

/** US-CRM-24 — the strip above the board, from the leads already loaded. "This month" is the calendar month in local time. */
export function pipelineSummary(leads: Lead[], now: number): PipelineSummary {
  const open = leads.filter((l) => l.stageKind === "open");
  const today = new Date(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const won = leads.filter((l) => l.stageKind === "won" && new Date(l.stageChangedAt).getTime() >= monthStart);
  const recent = leads.filter((l) => closedWithin(l, WIN_RATE_DAYS, now));
  const wonRecent = recent.filter((l) => l.stageKind === "won").length;
  return {
    open: { count: open.length, totals: totalsByCurrency(open) },
    wonThisMonth: { count: won.length, totals: totalsByCurrency(won) },
    winRate: { won: wonRecent, closed: recent.length, rate: recent.length ? Math.round((wonRecent / recent.length) * 100) : null },
    overdue: open.filter((l) => isOverdue(l, now)).length,
  };
}

/** Initials for an owner chip ("Priya Raman" → "PR"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
}
