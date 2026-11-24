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

/** PRD S-01.14 — see apps/api/src/db/schema/meetings.ts's meetingOccurrenceExceptions comment. */
export const meetingOccurrenceExceptionStatusSchema = z.enum(["modified", "cancelled"]);

/**
 * "series" (the default when omitted, preserving today's whole-series
 * behavior for any caller that doesn't know about occurrence scoping) mutates
 * the `meetings` row directly, same as before S-01.14. "occurrence" instead
 * upserts a row in `meeting_occurrence_exceptions` keyed on `occurrenceDate`,
 * leaving the series untouched.
 */
export const meetingMutationScopeSchema = z.enum(["series", "occurrence"]);

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

export const updateMeetingSchema = z
  .object({
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
    /** When provided, replaces the full invite list — MeetingsService diffs against existing attendees to decide who's newly invited vs. removed. Must not be sent alongside `scope: "occurrence"` — attendees are series-level only (PRD S-01.14). */
    attendeeUserIds: z.array(meetingAttendeeUserIdSchema).optional(),
    /** PRD S-01.14. Omitted/"series" preserves today's whole-series update behavior. */
    scope: meetingMutationScopeSchema.optional(),
    /** Required when scope is "occurrence" — identifies which occurrence this update applies to. */
    occurrenceDate: z.coerce.date().optional(),
  })
  .refine((value) => value.scope !== "occurrence" || value.occurrenceDate !== undefined, {
    message: "occurrenceDate is required when scope is \"occurrence\"",
    path: ["occurrenceDate"],
  })
  .refine((value) => value.scope !== "occurrence" || value.attendeeUserIds === undefined, {
    message: "attendeeUserIds cannot be changed for a single occurrence — attendees are series-level only",
    path: ["attendeeUserIds"],
  });

/** Query-param shape for `DELETE /meetings/:id?scope=occurrence&occurrenceDate=...` (PRD S-01.14). */
export const deleteMeetingScopeSchema = z
  .object({
    scope: meetingMutationScopeSchema.optional(),
    occurrenceDate: z.coerce.date().optional(),
  })
  .refine((value) => value.scope !== "occurrence" || value.occurrenceDate !== undefined, {
    message: "occurrenceDate is required when scope is \"occurrence\"",
    path: ["occurrenceDate"],
  });

/** Nested onto each `Meeting` in API responses — see apps/api/src/db/schema/meetings.ts's meetingOccurrenceExceptions comment. */
export const meetingOccurrenceExceptionSchema = z.object({
  id: uuidSchema,
  meetingId: uuidSchema,
  occurrenceDate: z.coerce.date(),
  status: meetingOccurrenceExceptionStatusSchema,
  startAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  title: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
});
