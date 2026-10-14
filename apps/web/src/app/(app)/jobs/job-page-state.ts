import type { JobActivityEntry } from "@spine/shared";
import { calendarDate, daysUntil } from "../quotes/quotes-list-state";
import type { Job, JobPhoto, Milestone } from "./types";

/** Milestones in the order they're billed. */
export function inOrder(milestones: Milestone[]): Milestone[] {
  return milestones.slice().sort((a, b) => a.sequence - b.sequence);
}

export type NextStep =
  | { kind: "invoice"; milestone: Milestone; label: string }
  | { kind: "complete"; milestone: Milestone; label: string }
  | { kind: "release"; label: string };

/**
 * US-JOB-34 (D-215) — the one primary button: invoice a completed
 * milestone, else complete the next one, else release retention once the
 * job is completed with retention held. Null when none of them applies or
 * the person can't do it.
 */
export function nextStep(
  job: Job,
  milestones: Milestone[],
  can: { invoice: boolean; complete: (m: Milestone) => boolean; release: boolean },
): NextStep | null {
  const ordered = inOrder(milestones);
  const toInvoice = ordered.find((m) => m.status === "completed");
  if (toInvoice && can.invoice) return { kind: "invoice", milestone: toInvoice, label: `Invoice ${toInvoice.name}` };
  if (job.status !== "completed" && job.status !== "cancelled") {
    const pending = ordered.find((m) => m.status === "pending");
    if (pending && can.complete(pending)) return { kind: "complete", milestone: pending, label: `Complete ${pending.name}` };
  }
  if (job.status === "completed" && BigInt(job.retentionHeld ?? "0") > 0n && can.release) return { kind: "release", label: "Release retention" };
  return null;
}

/** US-JOB-35 — "Due 30 Oct · in 20 days", "Due today", "Overdue 3 days". */
export function milestoneDueText(dueDate: string | null, now: Date, locale?: string): { text: string; tone: "" | "soon" | "over" } {
  if (!dueDate) return { text: "No due date", tone: "" };
  const days = daysUntil(dueDate, now);
  if (days < 0) return { text: `Overdue ${-days} ${-days === 1 ? "day" : "days"}`, tone: "over" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  return { text: `Due ${calendarDate(dueDate, now, locale)} · in ${days} ${days === 1 ? "day" : "days"}`, tone: days <= 7 ? "soon" : "" };
}

/** US-JOB-35 — what's billed so far: the invoiced milestones' amounts. */
export function billedByMilestones(milestones: Milestone[]): bigint {
  return milestones.filter((m) => m.status === "invoiced").reduce((sum, m) => sum + BigInt(m.resolvedAmount ?? "0"), 0n);
}

export interface PhotoGroup {
  key: string;
  label: string;
  /** "completed 7 Aug" for a milestone that's done. */
  note: string | null;
  photos: JobPhoto[];
}

/**
 * US-JOB-36 — "Site photos" first, then each milestone the photos were
 * added with, in billing order; oldest photo first within a group. Groups
 * without photos are left out.
 */
export function groupPhotos(photos: JobPhoto[], milestones: Milestone[], now: Date, locale?: string): PhotoGroup[] {
  const byTime = photos.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const known = new Set(milestones.map((m) => m.id));
  const groups: PhotoGroup[] = [{ key: "site", label: "Site photos", note: null, photos: byTime.filter((p) => !p.milestoneId || !known.has(p.milestoneId)) }];
  for (const m of inOrder(milestones)) {
    const done = m.completedAt ? `completed ${calendarDate(m.completedAt, now, locale)}` : null;
    groups.push({ key: m.id, label: m.name, note: done, photos: byTime.filter((p) => p.milestoneId === m.id) });
  }
  return groups.filter((g) => g.photos.length > 0);
}

/** Photos added together (same person, same milestone, within 10 minutes) become one entry: "3 photos added". */
export interface JobActivityItem extends JobActivityEntry {
  photos?: number;
}

const TOGETHER_MS = 10 * 60 * 1000;

export function groupJobActivity(entries: JobActivityEntry[]): JobActivityItem[] {
  const out: JobActivityItem[] = [];
  for (const entry of entries) {
    const last = out[out.length - 1];
    const together =
      entry.type === "photo_added" &&
      last?.type === "photo_added" &&
      last.actorName === entry.actorName &&
      last.detail === entry.detail &&
      Math.abs(new Date(last.at).getTime() - new Date(entry.at).getTime()) <= TOGETHER_MS;
    if (together) last.photos = (last.photos ?? 1) + 1;
    else out.push(entry.type === "photo_added" ? { ...entry, photos: 1 } : { ...entry });
  }
  return out;
}
