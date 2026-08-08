import type { CalendarEventColor, CalendarRecurrenceRule } from "@spine/ui";

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
  createdAt: string;
  updatedAt: string;
}
