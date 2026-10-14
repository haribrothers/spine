import type { TableSort } from "@spine/ui";
import { EMAIL_KINDS, EMAIL_KIND_LABELS, EMAIL_LOG_STATUSES, type EmailKind, type EmailLogEntry, type EmailLogStatus } from "@spine/shared";

/** How far back the list goes; the log keeps 180 days. */
export const EMAIL_RANGES = ["7", "30", "90", "180"] as const;
export type EmailRange = (typeof EMAIL_RANGES)[number];
export const EMAIL_RANGE_LABELS: Record<EmailRange, string> = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "180": "Last 180 days" };

/** US-SET-27 (D-210, D-220) — what the email log shows, kept in the address. */
export interface EmailsListState {
  q: string;
  status: EmailLogStatus[];
  kind: EmailKind[];
  range: EmailRange;
  /** One record's emails (from its "Email failed" message). */
  record: string;
  /** The Waiting and Failed cards. */
  card: "" | "waiting" | "failed";
  sort: TableSort | null;
  page: number;
}

const DEFAULT_RANGE: EmailRange = "30";
const WAITING: EmailLogStatus[] = ["queued", "retrying", "sending"];
const WEEK_MS = 7 * 86_400_000;

const listParam = <T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] =>
  [
    ...new Set(
      params
        .getAll(key)
        .flatMap((s) => s.split(","))
        .filter((s): s is T => (allowed as readonly string[]).includes(s)),
    ),
  ];

export function parseEmailsState(params: URLSearchParams): EmailsListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const range = params.get("range");
  const card = params.get("card");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    status: listParam(params, "status", EMAIL_LOG_STATUSES),
    kind: listParam(params, "kind", EMAIL_KINDS),
    range: (EMAIL_RANGES as readonly string[]).includes(range ?? "") ? (range as EmailRange) : DEFAULT_RANGE,
    record: params.get("record") ?? "",
    card: card === "waiting" || card === "failed" ? card : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/emails` is the last 30 days, newest first. */
export function emailsQuery(state: EmailsListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const s of state.status) params.append("status", s);
  for (const k of state.kind) params.append("kind", k);
  if (state.range !== DEFAULT_RANGE) params.set("range", state.range);
  if (state.record) params.set("record", state.record);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasEmailFilters(state: EmailsListState): boolean {
  return Boolean(state.q.trim() || state.status.length || state.kind.length || state.record || state.card || state.range !== DEFAULT_RANGE);
}

/** `GET /emails`' query for a state: the range, and one record when it's set. Everything else is filtered here. */
export function emailsApiQuery(state: EmailsListState, now: Date): string {
  const from = new Date(now.getTime() - Number(state.range) * 86_400_000);
  const params = new URLSearchParams({ from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}` });
  if (state.record) params.set("entityId", state.record);
  return params.toString();
}

/** US-SET-27 — the recipient, their name, the subject and the record's number contain the search (case-insensitive). */
export function matchesEmailSearch(email: EmailLogEntry, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [email.toAddress, email.toName ?? "", email.subject, email.recordLabel ?? "", EMAIL_KIND_LABELS[email.kind]].some((field) => field.toLowerCase().includes(needle));
}

export function isWaiting(email: EmailLogEntry): boolean {
  return WAITING.includes(email.status);
}

/** Failed in the last 7 days and not retried or cancelled since. */
export function isRecentlyFailed(email: EmailLogEntry, now: Date): boolean {
  return email.status === "failed" && Boolean(email.failedAt) && now.getTime() - new Date(email.failedAt!).getTime() <= WEEK_MS;
}

export function filterEmails(list: EmailLogEntry[], state: EmailsListState, now: Date): EmailLogEntry[] {
  return list.filter((email) => {
    if (state.card === "waiting" && !isWaiting(email)) return false;
    if (state.card === "failed" && !isRecentlyFailed(email, now)) return false;
    if (state.status.length && !state.status.includes(email.status)) return false;
    if (state.kind.length && !state.kind.includes(email.kind)) return false;
    return matchesEmailSearch(email, state.q);
  });
}

/** The line under a subject: why it failed, when it's retried, or who cancelled it. */
export function emailNote(email: EmailLogEntry, locale?: string): { text: string; error: boolean } | null {
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (email.waitingForSetup) return { text: "Waiting for email to be set up", error: false };
  if (email.status === "retrying") return { text: [email.nextAttemptAt ? `Retrying at ${time(email.nextAttemptAt)}` : "Retrying soon", email.lastError].filter(Boolean).join(" · "), error: true };
  if (email.status === "failed") return { text: email.lastError ?? "Couldn't be sent", error: true };
  if (email.status === "cancelled") return { text: email.cancelledByName ? `Cancelled by ${email.cancelledByName}` : "Cancelled", error: false };
  return null;
}

/** "Payment reminder for INV-0039" — how the confirmations name an email. */
export function emailDescription(email: EmailLogEntry): string {
  const kind = email.kind === "invoice_reminder" ? "payment reminder" : EMAIL_KIND_LABELS[email.kind].toLowerCase();
  return email.recordLabel ? `The ${kind} for ${email.recordLabel}` : `“${email.subject}”`;
}
