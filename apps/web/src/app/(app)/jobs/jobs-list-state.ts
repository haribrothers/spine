import type { TableSort } from "@spine/ui";
import { calendarDate, daysUntil } from "../quotes/quotes-list-state";
import type { Job, JobStatus } from "./types";
import { t } from "../../../lib/i18n";

/** US-JOB-31 — the cards that filter the list. */
export type JobCard = "" | "active" | "ready" | "budget";

/** US-JOB-32 (D-210, D-215) — what the jobs list shows, kept in the address. */
export interface JobsListState {
  q: string;
  /** active, on_hold, completed and/or cancelled; empty means every status. */
  status: JobStatus[];
  contact: string;
  card: JobCard;
  sort: TableSort | null;
  page: number;
}

const STATUSES: JobStatus[] = ["active", "on_hold", "completed", "cancelled"];
const CARDS: JobCard[] = ["active", "ready", "budget"];

export function parseJobsState(params: URLSearchParams): JobsListState {
  const status = params
    .getAll("status")
    .flatMap((s) => s.split(","))
    .filter((s): s is JobStatus => STATUSES.includes(s as JobStatus));
  const card = params.get("card") as JobCard | null;
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    status,
    contact: params.get("contact") ?? "",
    card: card && CARDS.includes(card) ? card : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/jobs` is the whole list, newest first. */
export function jobsQuery(state: JobsListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const s of state.status) params.append("status", s);
  if (state.contact) params.set("contact", state.contact);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasJobFilters(state: JobsListState): boolean {
  return Boolean(state.q.trim() || state.status.length || state.contact || state.card);
}

export function isReadyToBill(job: Job): boolean {
  return (job.readyToBillCount ?? 0) > 0;
}

export function isOverOrNearBudget(job: Job): boolean {
  return job.budgetState === "over" || job.budgetState === "near";
}

export interface MoneySum {
  count: number;
  /** In the business's currency, minor units. */
  amount: bigint;
  /** Some jobs are in another currency, so aren't in `amount`. */
  otherCurrencies: boolean;
}

function sum(jobs: Job[], currency: string, amountOf: (job: Job) => string | undefined): MoneySum {
  let amount = 0n;
  let other = false;
  for (const job of jobs) {
    const value = BigInt(amountOf(job) ?? "0");
    if (job.currency === currency) amount += value;
    else if (value !== 0n) other = true;
  }
  return { count: jobs.length, amount, otherCurrencies: other };
}

export interface JobStats {
  active: MoneySum;
  ready: MoneySum;
  /** Null when the person can't see job profitability (the card doesn't show). */
  budget: number | null;
  /** `count` is the jobs holding retention. */
  retention: MoneySum;
}

/** US-JOB-31 — the cards' figures. */
export function jobStats(jobs: Job[], currency: string, canSeeBudget: boolean): JobStats {
  const active = jobs.filter((j) => j.status === "active");
  const holding = jobs.filter((j) => BigInt(j.retentionHeld ?? "0") > 0n);
  return {
    active: sum(active, currency, (j) => j.contractValueAmount),
    ready: sum(jobs.filter(isReadyToBill), currency, (j) => j.readyToBillAmount),
    budget: canSeeBudget ? jobs.filter(isOverOrNearBudget).length : null,
    retention: sum(holding, currency, (j) => j.retentionHeld),
  };
}

/** US-JOB-32 — number, name, contact or site address contains the search (case-insensitive). */
export function matchesJobSearch(job: Job, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [job.number ?? "", job.name, job.contactName ?? "", job.siteAddress ?? ""].some((field) => field.toLowerCase().includes(needle));
}

export function filterJobs(jobs: Job[], state: JobsListState): Job[] {
  return jobs.filter((job) => {
    if (state.contact && job.contactId !== state.contact) return false;
    if (state.status.length && !state.status.includes(job.status)) return false;
    if (state.card === "active" && job.status !== "active") return false;
    if (state.card === "ready" && !isReadyToBill(job)) return false;
    if (state.card === "budget" && !isOverOrNearBudget(job)) return false;
    return matchesJobSearch(job, state.q);
  });
}

/** The contacts that have a job, for the Contact filter. */
export function jobContacts(jobs: Job[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const job of jobs) if (!seen.has(job.contactId)) seen.set(job.contactId, job.contactName ?? t("jobs.list.unknownContact"));
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** "Due 14 Oct", "Due in 3 days", "Due today", "Overdue 2 days" — a milestone's due state (US-JOB-33, US-JOB-35). */
export function dueNote(dueDate: string | null, now: Date, locale?: string): { text: string; tone: "" | "soon" | "over" } {
  if (!dueDate) return { text: t("jobs.due.noDueDate"), tone: "" };
  const days = daysUntil(dueDate, now);
  if (days < 0) return { text: t("jobs.due.overdue", { count: -days }), tone: "over" };
  if (days === 0) return { text: t("jobs.due.today"), tone: "soon" };
  if (days <= 7) return { text: t("jobs.due.in", { count: days }), tone: "soon" };
  return { text: t("jobs.due.on", { date: calendarDate(dueDate, now, locale) }), tone: "" };
}

/** US-JOB-33 — what the Next milestone column says. */
export function nextMilestoneNote(job: Job, now: Date, locale?: string): { name: string; text: string; tone: "" | "soon" | "over" } {
  if (job.nextMilestone) return { name: job.nextMilestone.name, ...dueNote(job.nextMilestone.dueDate, now, locale) };
  if (!job.milestoneCounts?.total) return { name: t("jobs.next.noMilestones"), text: "", tone: "" };
  if (isReadyToBill(job)) return { name: t("jobs.next.readyToBill"), text: t("jobs.next.toInvoice", { count: job.readyToBillCount ?? 0 }), tone: "soon" };
  return { name: t("jobs.next.allBilled"), text: "", tone: "" };
}

/** US-JOB-33 — the owner's % complete, else the share of milestones done; null without either. */
export function completePct(job: Job): number | null {
  if (job.percentComplete !== null && job.percentComplete !== undefined) return Math.round(job.percentComplete);
  const counts = job.milestoneCounts;
  return counts?.total ? Math.round((counts.completed / counts.total) * 100) : null;
}
