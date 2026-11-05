import type { LocalPhoto, OutboxItem } from "./types";
import { t } from "../i18n";

export interface JobWaiting {
  /** Photos of this job not yet sent (site photos and those with a completion), oldest first. */
  photos: { photo: LocalPhoto; queuedAt: number }[];
  /** Site photos waiting, for "2 photos waiting". */
  sitePhotos: number;
  /** Milestones whose completion is queued: "Completion waiting". */
  completionMilestoneIds: string[];
}

/** What of one job is still on the phone (US-MOB-07: waiting chips on its card and screen). */
export function jobWaiting(items: readonly OutboxItem[], jobId: string): JobWaiting {
  const open = items.filter((item) => item.status !== "sent" && item.kind !== "expense" && item.payload.jobId === jobId);
  const photos = open.flatMap((item) => (item.kind === "expense" ? [] : item.payload.photos.filter((p) => !p.attached).map((photo) => ({ photo, queuedAt: item.createdAt }))));
  return {
    photos,
    sitePhotos: open.filter((item) => item.kind === "photos").reduce((sum, item) => sum + (item.kind === "photos" ? item.payload.photos.length : 0), 0),
    completionMilestoneIds: open.flatMap((item) => (item.kind === "completion" ? [item.payload.milestoneId] : [])),
  };
}

/** "2 photos waiting", "Completion waiting". */
export function waitingChips(waiting: JobWaiting): string[] {
  return [
    ...(waiting.sitePhotos ? [t("mobileApp.outbox.photosWaiting", { count: waiting.sitePhotos })] : []),
    ...(waiting.completionMilestoneIds.length ? [t("mobileApp.outbox.completionWaiting")] : []),
  ];
}
