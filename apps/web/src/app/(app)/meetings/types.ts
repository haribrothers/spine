import type { CalendarEventColor, CalendarRecurrenceRule } from "@spine/ui";

export type MeetingVisibility = "private" | "org";
export type MeetingAttendeeStatus = "invited" | "accepted" | "declined" | "tentative";
export type MeetingOccurrenceExceptionStatus = "modified" | "cancelled";

/** PRD S-01.14 — mirrors apps/api's meeting_occurrence_exceptions row shape. */
export interface MeetingOccurrenceException {
  id: string;
  meetingId: string;
  occurrenceDate: string;
  status: MeetingOccurrenceExceptionStatus;
  startAt: string | null;
  endAt: string | null;
  title: string | null;
  location: string | null;
  description: string | null;
}

/** Mirrors apps/api/src/db/schema/meetings.ts's row shape — apps/web has no generated SDK yet (packages/sdk is still empty), same hand-written-mirror precedent as contacts/quotes/types.ts. */
export interface Meeting {
  id: string;
  orgId: string;
  contactId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: CalendarEventColor;
  description: string | null;
  location: string | null;
  /** Same shape as @spine/ui's CalendarRecurrenceRule, except `end.date` is serialized as an ISO string over JSON rather than a Date — see toCalendarEvent's own conversion. */
  recurrence: (Omit<CalendarRecurrenceRule, "end"> & { end: { type: "date"; date: string } | { type: "count"; count: number } }) | null;
  organizerUserId: string | null;
  /** PRD S-01.10/S-01.11 — "private" (default) visible only to organizer + invited attendees; "org" visible to everyone. */
  visibility: MeetingVisibility;
  /** PRD S-01.14 — per-occurrence overrides/cancellations for a recurring meeting. Always present (empty array when none exist), never undefined, on any row returned by the API. */
  occurrenceExceptions: MeetingOccurrenceException[];
  createdAt: string;
  updatedAt: string;
}

/** Mirrors apps/api's GET /meetings/:id/attendees row shape (meetingAttendees joined to user). */
export interface MeetingAttendee {
  id: string;
  userId: string | null;
  status: MeetingAttendeeStatus;
  invitedAt: string;
  respondedAt: string | null;
  name: string | null;
  email: string | null;
}
