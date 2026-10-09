import { cache } from "../cache/cache-store";
import { calendarDay, daysUntil } from "../format";
import { useCachedQuery } from "./use-cached-query";

/** A job as the phone gets it (US-JOB-19: never money fields). */
export interface FieldJob {
  id: string;
  number: string | null;
  name: string;
  status: "active" | "on_hold" | "completed" | "cancelled";
  contactId: string;
  contactName: string | null;
  siteAddress: string | null;
  nextMilestone: { id: string; name: string; dueDate: string | null } | null;
  siteContact: SiteContact | null;
  milestoneCounts?: { total: number; completed: number };
}

export interface SiteContact {
  name: string;
  title: string | null;
  phone: string | null;
}

export interface FieldMilestone {
  id: string;
  name: string;
  sequence: number;
  status: "pending" | "completed" | "invoiced";
  dueDate: string | null;
  completedAt: string | null;
}

export interface JobPhoto {
  id: string;
  fileId: string;
  caption: string | null;
  milestoneId: string | null;
  createdAt: string;
}

export interface QuoteToPresent {
  id: string;
  number: string | null;
  kind: "variation" | "source";
  title: string | null;
  sentAt: string | null;
  validUntil: string | null;
}

export const JOBS_KEY = "jobs";
export const JOBS_PATH = "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts";
export const jobKey = (id: string) => `job:${id}`;
export const milestonesKey = (id: string) => `job:${id}:milestones`;
export const photosKey = (id: string) => `job:${id}:photos`;
export const quotesKey = (id: string) => `job:${id}:quotes`;

/**
 * US-JOB-16 — a job that left the list (the person was taken off its crew)
 * loses its cached copy: detail, milestones, photos and quotes.
 */
export async function pruneJobCaches(jobs: FieldJob[]): Promise<void> {
  const keep = new Set(jobs.map((job) => job.id));
  const stale = (await cache.keys("job:")).filter((key) => !keep.has(key.split(":")[1] ?? ""));
  await cache.remove(stale);
}

/** My assigned jobs (`GET /jobs?assignedToMe=true`), cached; pruned as above. */
export function useAssignedJobs(enabled = true) {
  // A completion moves a job's next milestone on.
  return useCachedQuery<FieldJob[]>(JOBS_KEY, JOBS_PATH, { onFresh: pruneJobCaches, enabled, refreshOnSent: (item) => item.kind === "completion" });
}

/**
 * US-MOB-03 — Today lists a job only while it's Active with a pending
 * milestone that's overdue or due within the next 7 days.
 */
export function isOnToday(job: FieldJob, now: Date = new Date()): boolean {
  const due = job.nextMilestone?.dueDate;
  return job.status === "active" && Boolean(due) && daysUntil(calendarDay(due!), now) <= 7;
}

/** Today's jobs, most urgent first. */
export function todaysJobs(jobs: FieldJob[], now: Date = new Date()): FieldJob[] {
  return jobs.filter((job) => isOnToday(job, now)).sort((a, b) => (a.nextMilestone!.dueDate! < b.nextMilestone!.dueDate! ? -1 : 1));
}
