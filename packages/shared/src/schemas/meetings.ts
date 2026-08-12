import { z } from "zod";
import { uuidSchema } from "./common.ts";

/** Mirrors @spine/ui's CALENDAR_EVENT_COLORS (packages/ui/src/lib/calendar-utils.ts). */
export const meetingColorSchema = z.enum(["blue", "green", "amber", "red", "purple", "teal", "pink", "slate"]);

/** Mirrors @spine/ui's CalendarRecurrenceRule shape verbatim — see apps/api/src/db/schema/meetings.ts's own comment on why the API stores the rule as-authored rather than expanding occurrences. */
export const meetingRecurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().positive().optional(),
  end: z.union([
    z.object({ type: z.literal("date"), date: z.coerce.date() }),
    z.object({ type: z.literal("count"), count: z.number().int().positive() }),
  ]),
});

/** PRD S-01.10/S-01.11 — see apps/api/src/db/schema/meetings.ts's meetingVisibilityEnum comment. */
export const meetingVisibilitySchema = z.enum(["private", "org"]);

/**
 * `user.id` (Better Auth) is a plain `text` primary key, not a uuid — do not
 * reuse `uuidSchema` here.
 */
export const meetingAttendeeUserIdSchema = z.string().min(1);

export const meetingAttendeeStatusSchema = z.enum(["invited", "accepted", "declined", "tentative"]);

/** "invited" is excluded — that's the system-set initial state, never something a user sets via respond(). */
export const respondToMeetingSchema = z.object({
  status: z.enum(["accepted", "declined", "tentative"]),
});

export const createMeetingSchema = z
  .object({
    contactId: uuidSchema.optional().nullable(),
    title: z.string().min(1),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    allDay: z.boolean().optional(),
    color: meetingColorSchema.optional(),
    description: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    recurrence: meetingRecurrenceSchema.optional().nullable(),
    /** Defaults to "private" server-side when omitted. */
    visibility: meetingVisibilitySchema.optional(),
    attendeeUserIds: z.array(meetingAttendeeUserIdSchema).optional(),
  })
  .refine((value) => value.endAt >= value.startAt, {
    message: "endAt must not be before startAt",
    path: ["endAt"],
  });

export const updateMeetingSchema = z.object({
  contactId: uuidSchema.optional().nullable(),
  title: z.string().min(1).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  color: meetingColorSchema.optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  recurrence: meetingRecurrenceSchema.optional().nullable(),
  visibility: meetingVisibilitySchema.optional(),
  /** When provided, replaces the full invite list — MeetingsService diffs against existing attendees to decide who's newly invited vs. removed. */
  attendeeUserIds: z.array(meetingAttendeeUserIdSchema).optional(),
});
