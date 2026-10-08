import type { Href } from "expo-router";

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  detail: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATIONS_KEY = "notifications";
export const NOTIFICATIONS_PATH = "/notifications?limit=50";
export const UNREAD_KEY = "notifications:unread";
export const UNREAD_PATH = "/notifications/unread-count";

/** "9+" above nine (US-MOB-22). */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/**
 * Where a notification lands on the phone: its job, expense or meeting.
 * The web's links (`/jobs/<id>`, `/expenses/<id>`, `/meetings?id=<id>`) map
 * onto the app's routes; anything else just marks it read.
 */
export function routeForLink(link: string | null): Href | null {
  if (!link) return null;
  const job = /^\/jobs\/([^/?#]+)$/.exec(link);
  if (job) return `/jobs/${job[1]}`;
  const expense = /^\/expenses\/([^/?#]+)$/.exec(link);
  if (expense) return `/expenses/${expense[1]}`;
  const meeting = /^\/meetings\?id=([^&#]+)/.exec(link);
  if (meeting) return `/meetings/${meeting[1]}`;
  return null;
}

/** The list split as drawn: "NEW" (unread) and "EARLIER". */
export function splitByRead(items: AppNotification[]): { fresh: AppNotification[]; earlier: AppNotification[] } {
  return { fresh: items.filter((n) => !n.readAt), earlier: items.filter((n) => n.readAt) };
}
