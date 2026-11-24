/**
 * US-DASH-16 — the dashboard's "Today" list: my meetings today, milestones
 * due within 7 days on jobs I can see, my follow-ups due today or overdue,
 * and my next meeting after today, in time order. The three sources are
 * fetched separately and merged here. Times are read in the viewer's local
 * time, which is the organisation's (one organisation per install).
 */

export interface TodayMeeting {
  id: string;
  title: string;
  startAt: string;
  allDay?: boolean;
  location?: string | null;
}

export interface TodayMilestone {
  milestoneId: string;
  jobId: string;
  jobName: string;
  name: string;
  /** ISO date or timestamp. */
  dueDate: string;
}

export interface TodayFollowup {
  id: string;
  type: "call" | "meeting" | "note" | "task";
  notes: string | null;
  dueAt: string;
  contactId: string | null;
  contactName?: string | null;
}

export type TodayKind = "meeting" | "milestone" | "followup";

export interface TodayEntry {
  kind: TodayKind;
  id: string;
  /** "2:30 PM", "Due Sat", "Today", "Mon 8:00" */
  when: string;
  title: string;
  /** "Meeting · office", "Milestone · Marina office fit-out" */
  detail: string;
  href: string;
  /** For ordering. */
  at: number;
}

const FOLLOWUP_TYPES: Record<TodayFollowup["type"], string> = { call: "Call", meeting: "Meeting", note: "Note", task: "Task" };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A `YYYY-MM-DD` (or ISO timestamp's date) as local midnight. */
function localDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function time(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Sat" within a week either side, else "28 Sep". */
function shortDay(d: Date, now: Date): string {
  const days = dayDiff(now, d);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (Math.abs(days) < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function join(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}

export function buildToday(input: { meetings: TodayMeeting[]; milestones: TodayMilestone[]; followups: TodayFollowup[]; now: Date }): TodayEntry[] {
  const { now } = input;
  const today = startOfDay(now);
  const entries: TodayEntry[] = [];

  const meetings = [...input.meetings].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  for (const m of meetings.filter((m) => dayDiff(today, new Date(m.startAt)) <= 0)) {
    const start = new Date(m.startAt);
    entries.push({ kind: "meeting", id: m.id, when: m.allDay ? "All day" : time(start), title: m.title, detail: join(["Meeting", m.location]), href: `/meetings?id=${m.id}`, at: start.getTime() });
  }
  const next = meetings.find((m) => dayDiff(today, new Date(m.startAt)) > 0);
  if (next) {
    const start = new Date(next.startAt);
    const day = dayDiff(today, start) === 1 ? "Tomorrow" : start.toLocaleDateString("en-GB", { weekday: "short" });
    const when = next.allDay ? day : `${day} ${start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
    entries.push({ kind: "meeting", id: next.id, when, title: next.title, detail: join(["Meeting", next.location]), href: `/meetings?id=${next.id}`, at: start.getTime() });
  }

  for (const ms of input.milestones) {
    const due = localDate(ms.dueDate);
    if (dayDiff(today, due) > 7) continue;
    const day = shortDay(due, now);
    entries.push({ kind: "milestone", id: ms.milestoneId, when: `Due ${day}`, title: ms.name, detail: join(["Milestone", ms.jobName]), href: `/jobs/${ms.jobId}`, at: due.getTime() });
  }

  for (const f of input.followups) {
    const due = new Date(f.dueAt);
    if (dayDiff(today, due) > 0) continue;
    entries.push({
      kind: "followup",
      id: f.id,
      when: dayDiff(today, due) === 0 ? "Today" : `Due ${shortDay(due, now)}`,
      title: f.notes?.trim() || FOLLOWUP_TYPES[f.type],
      detail: join(["Follow-up", f.contactName]),
      href: f.contactId ? `/contacts/${f.contactId}` : "/leads",
      at: due.getTime(),
    });
  }

  return entries.sort((a, b) => a.at - b.at);
}
