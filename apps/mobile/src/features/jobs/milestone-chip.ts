import type { FieldJob } from "../../lib/data/jobs";
import { dueChip, type ChipStatus } from "../../lib/format";

/**
 * A job's milestone status on the Jobs list (US-MOB-04): "Milestone due
 * Sat", "Milestone 2 days late", "All milestones complete", or nothing
 * when the job has no milestones yet.
 */
export function jobMilestoneChip(job: FieldJob, locale: string, now: Date = new Date()): { label: string; status: ChipStatus } | null {
  const due = job.nextMilestone?.dueDate;
  if (due) {
    const chip = dueChip(due, locale, now);
    return { label: chip.status === "overdue" ? `Milestone ${chip.label}` : `Milestone ${chip.label.replace(/^Due/, "due")}`, status: chip.status };
  }
  if (job.nextMilestone) return { label: "Milestone pending", status: "draft" };
  const counts = job.milestoneCounts;
  if (counts && counts.total > 0 && counts.completed === counts.total) return { label: "All milestones complete", status: "paid" };
  return null;
}
