import type { FieldJob, FieldMilestone, JobPhoto, QuoteToPresent } from "../lib/data/jobs";
import type { TodaySummary } from "../lib/data/today";
import type { Meeting } from "../lib/data/meetings";
import type { MyExpense } from "../lib/data/expenses";
import type { AppNotification } from "../lib/data/notifications";

/** Thursday 8 October 2026, 9:41 — the designs' day. */
export const THURSDAY = new Date(2026, 9, 8, 9, 41);

/** Fakes only the clock, so promises and timers run as usual. */
export function freezeClock(at: Date = THURSDAY) {
  jest.useFakeTimers({ now: at, doNotFake: ["nextTick", "setImmediate", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame"] });
}

export const MARINA: FieldJob = {
  id: "job-marina",
  number: "JOB-001",
  name: "Marina office fit-out",
  status: "active",
  contactId: "c-1",
  contactName: "Harborview Construction Co.",
  siteAddress: "48 Harbor Way, Portland, ME 04101",
  nextMilestone: { id: "m-1", name: "Mobilisation & site setup", dueDate: "2026-10-10" },
  siteContact: { name: "Alan Reyes", title: "Procurement Manager", phone: "+1 207 555 0142" },
  milestoneCounts: { total: 3, completed: 0 },
};

export const TOWNHOMES: FieldJob = {
  id: "job-townhomes",
  number: "JOB-002",
  name: "Phase 2 townhomes — foundations",
  status: "active",
  contactId: "c-2",
  contactName: "Maple Ridge Developments",
  siteAddress: "220 Ridge Rd, Burlington, VT 05401",
  nextMilestone: { id: "m-9", name: "Foundation walls poured", dueDate: "2026-10-06" },
  siteContact: { name: "Sarah Kim", title: null, phone: "+1 802 555 0199" },
  milestoneCounts: { total: 4, completed: 1 },
};

export const HOTEL: FieldJob = {
  id: "job-hotel",
  number: "JOB-003",
  name: "Hotel lobby renovation",
  status: "active",
  contactId: "c-3",
  contactName: "Bluewater Hospitality Group",
  siteAddress: "5 Water St, Providence, RI 02903",
  nextMilestone: null,
  siteContact: null,
  milestoneCounts: { total: 3, completed: 3 },
};

/** Active, but its next milestone is weeks away: Jobs tab only. */
export const LATER_JOB: FieldJob = { ...MARINA, id: "job-later", name: "Warehouse racking", nextMilestone: { id: "m-20", name: "Racking delivered", dueDate: "2026-11-20" } };
/** On hold with an overdue milestone: Jobs tab only. */
export const ON_HOLD: FieldJob = { ...TOWNHOMES, id: "job-hold", name: "Paused extension", status: "on_hold" };

export const SUMMARY: TodaySummary = {
  period: "month",
  today: "2026-10-08",
  from: "2026-10-01",
  to: "2026-10-31",
  milestones: { done: 3, total: 5, due: 3, nextDueDate: "2026-10-10", overdue: 1, oldestOverdueDate: "2026-10-06" },
  photos: { taken: 12 },
  expenses: { total: "10620", count: 2, awaitingApproval: 1, currency: "USD" },
};

export const MEETING: Meeting = {
  id: "meet-1",
  title: "Progress review — Phase 2 townhomes",
  startAt: new Date(2026, 9, 11, 9, 0).toISOString(),
  endAt: new Date(2026, 9, 11, 10, 0).toISOString(),
  allDay: false,
  location: "220 Ridge Rd",
  description: null,
};

export const MILESTONES: FieldMilestone[] = [
  { id: "m-1", name: "Mobilisation & site setup", sequence: 0, status: "pending", dueDate: "2026-10-10T00:00:00.000Z", completedAt: null },
  { id: "m-2", name: "Framing & rough-in complete", sequence: 1, status: "pending", dueDate: "2026-11-03T00:00:00.000Z", completedAt: null },
  { id: "m-0", name: "Site survey", sequence: -1, status: "completed", dueDate: "2026-09-20T00:00:00.000Z", completedAt: "2026-09-21T10:00:00.000Z" },
];

export function photos(count: number): JobPhoto[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p-${i}`, fileId: `f-${i}`, caption: null, milestoneId: null, createdAt: new Date(2026, 9, i < 2 ? 8 : i < 8 ? 5 : 1, 10, i).toISOString() }));
}

export const QUOTES: QuoteToPresent[] = [{ id: "q-4", number: "QUO-0004", kind: "variation", title: "Additional electrical outlets", sentAt: "2026-10-06T09:00:00.000Z", validUntil: null }];

export const EXPENSES: MyExpense[] = [
  { id: "e-1", number: null, categoryName: "Fuel & Vehicle", jobId: "job-marina", date: "2026-10-08", amount: "6420", currency: "USD", description: "Van fuel", status: "submitted", reviewComment: null, createdAt: "2026-10-08T08:00:00.000Z" },
  { id: "e-2", number: "EXP-0012", categoryName: "Site Meals", jobId: "job-marina", date: "2026-09-27", amount: "4200", currency: "USD", description: null, status: "approved", reviewComment: null, createdAt: "2026-09-27T12:00:00.000Z" },
  { id: "e-3", number: null, categoryName: "Materials", jobId: null, date: "2026-10-02", amount: "19200", currency: "USD", description: "Café supplies", status: "rejected", reviewComment: "No receipt attached — please add one next time.", createdAt: "2026-10-02T12:00:00.000Z" },
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n-1", type: "expense_rejected", message: "Sarah Mendes rejected your expense", detail: "Fuel & Vehicle · $38.50 · “No receipt attached — please add one next time.”", link: "/expenses/e-3", readAt: null, createdAt: new Date(THURSDAY.getTime() - 10 * 60_000).toISOString() },
  { id: "n-2", type: "crew_assigned", message: "You're on the crew for Phase 2 townhomes — foundations", detail: "Added by Sarah Mendes · 220 Ridge Rd, Burlington", link: "/jobs/job-townhomes", readAt: null, createdAt: new Date(THURSDAY.getTime() - 60 * 60_000).toISOString() },
  { id: "n-3", type: "meeting_invited", message: "Invitation: Progress review — Phase 2 townhomes", detail: null, link: "/meetings?id=meet-1", readAt: "2026-10-07T10:00:00.000Z", createdAt: "2026-10-06T10:00:00.000Z" },
];

/**
 * A `request` stand-in that answers by path (GET) and records every call.
 * A path mapped to an Error throws it.
 */
export function routeRequests(routes: Record<string, unknown>) {
  return jest.fn(async (method: string, path: string) => {
    if (method !== "GET") return {};
    if (!(path in routes)) throw new Error(`No fixture for ${path}`);
    const value = routes[path];
    if (value instanceof Error) throw value;
    return value;
  });
}

/** A promise you resolve later: a request that is still out (skeleton tests, D-201). */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** A request that never answers. */
export const PENDING = new Promise<never>(() => {});
