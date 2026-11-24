import { pgTable, uuid, text, boolean, timestamp, jsonb, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { contacts } from "./contacts";

/**
 * Mirrors @spine/ui's CALENDAR_EVENT_COLORS (packages/ui/src/lib/calendar-utils.ts)
 * — kept in sync manually since the web app's Calendar component owns that
 * list and the API has no dependency on @spine/ui.
 */
export const meetingColorEnum = pgEnum("meeting_color", [
  "blue",
  "green",
  "amber",
  "red",
  "purple",
  "teal",
  "pink",
  "slate",
]);

/**
 * PRD S-01.10/S-01.11 — `private` (default) is visible only to the organizer
 * and invited attendees (see `meetingAttendees` below); `org` is visible to
 * every org member, matching the app's pre-existing behavior before this
 * visibility model existed. Owners always see every meeting regardless of
 * this value, per §2.1's blanket-access rule — that's enforced in
 * MeetingsService, not here.
 */
export const meetingVisibilityEnum = pgEnum("meeting_visibility", ["private", "org"]);

export const meetingAttendeeStatusEnum = pgEnum("meeting_attendee_status", [
  "invited",
  "accepted",
  "declined",
  "tentative",
]);

/**
 * PRD S-01.9 — scheduled meetings, shown on the /meetings calendar page and
 * (when linked to a contact) on that contact's Timeline tab (S-01.3). A
 * dedicated table, not folded into `activities`: a real calendar event
 * needs a time range and optional recurrence that `activities`' flat,
 * single `dueAt` was never designed to hold (see that table's own comment).
 * `activities`' "meeting" type is unrelated and untouched by this table —
 * it remains a quick log entry, not a scheduled event.
 *
 * `contactId` is nullable — a meeting isn't required to have a contact
 * (e.g. an internal team meeting), matching S-01.9's acceptance highlight.
 * `recurrence` mirrors @spine/ui's CalendarRecurrenceRule shape
 * (`{ frequency, interval?, end: { type: "date", date } | { type: "count", count } }`)
 * verbatim as jsonb — recurrence expansion is a pure function client-side
 * (calendar-utils.ts), so the API stores the rule as-authored rather than
 * expanding/storing individual occurrences.
 */
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    color: meetingColorEnum("color").notNull().default("blue"),
    description: text("description"),
    location: text("location"),
    recurrence: jsonb("recurrence").$type<{
      frequency: "daily" | "weekly" | "monthly";
      interval?: number;
      end: { type: "date"; date: string } | { type: "count"; count: number };
    }>(),
    organizerUserId: text("organizer_user_id").references(() => user.id, { onDelete: "set null" }),
    /** PRD S-01.10/S-01.11 — see meetingVisibilityEnum's own comment. */
    visibility: meetingVisibilityEnum("visibility").notNull().default("private"),
    /** Same demo-data marker convention as contacts.isDemo/quotes.isDemo — meetings have no cascading demo-flagged parent (contactId is nullable and set-null on delete), so this is DemoDataService.deleteAll's own removal handle. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("meetings_org_idx").on(table.orgId),
    index("meetings_contact_idx").on(table.contactId),
    index("meetings_org_start_idx").on(table.orgId, table.startAt),
    index("meetings_org_demo_idx").on(table.orgId, table.isDemo),
  ],
);

/**
 * PRD S-01.10/S-01.12 — who's invited to a meeting and their response.
 * `userId` is nullable with ON DELETE SET NULL (not cascade) so a departed
 * member's historical attendance record survives their removal from the
 * org, matching `meetings.organizerUserId`'s own retention behavior — see
 * Spine's permission-model section and PRD §7 for why this repo prefers
 * retaining history over cascading deletes for membership-adjacent data.
 *
 * The organizer always gets a synthetic row here too (status "accepted",
 * set at creation time in MeetingsService.create) so reminder/response
 * logic never has to special-case "is this the organizer" — see
 * MeetingsService for that invariant.
 *
 * `remindedAt`/`remindedForOccurrenceStart` back the S-10.21 "starting
 * soon" reminder. Recurring meetings apply attendees to the whole series
 * (no per-occurrence overrides, PRD explicit) but attendees must still be
 * reminded before *every* occurrence, not just once ever — so reminder
 * state is keyed against which occurrence's start was last reminded for
 * (`remindedForOccurrenceStart`), and a poll tick reminds again whenever
 * the next-upcoming occurrence's start doesn't match it. For a
 * non-recurring meeting, "the occurrence" is just the meeting's own
 * `startAt`, so the same column/logic covers both cases with no branch.
 */
export const meetingAttendees = pgTable(
  "meeting_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: meetingAttendeeStatusEnum("status").notNull().default("invited"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    remindedForOccurrenceStart: timestamp("reminded_for_occurrence_start", { withTimezone: true }),
  },
  (table) => [
    // Multiple NULL userId rows don't collide under a plain unique
    // constraint — intended, since ON DELETE SET NULL can otherwise
    // produce several history rows with no user for the same meeting.
    unique("meeting_attendees_meeting_user_unique").on(table.meetingId, table.userId),
    index("meeting_attendees_meeting_idx").on(table.meetingId),
    index("meeting_attendees_user_idx").on(table.userId),
  ],
);

export const meetingOccurrenceExceptionStatusEnum = pgEnum("meeting_occurrence_exception_status", [
  "modified",
  "cancelled",
]);

/**
 * PRD S-01.14 — lets a single occurrence of a recurring meeting diverge from
 * its series' `recurrence` rule without mutating the series row. This is the
 * only place per-occurrence state exists; the series row (`meetings`) is
 * still the single source of truth for the recurrence rule, attendees, and
 * visibility, none of which this table overrides (attendees/visibility stay
 * series-level only in v1 — PRD explicit).
 *
 * `occurrenceDate` is the occurrence's *unmodified* computed start, i.e. the
 * date the series' `recurrence` rule would have produced before any
 * override — this is the stable key an exception attaches to, so a
 * `modified` row can still move `startAt` elsewhere without losing its
 * identity. A `cancelled` row's override columns stay null (nothing to
 * override — it just shouldn't be rendered).
 *
 * Like `meetings.recurrence`, expansion into individual calendar instances
 * is a client-side, pure-function concern (calendar-utils.ts) — this table
 * is shipped to the client raw and consulted there, not expanded server-side.
 */
export const meetingOccurrenceExceptions = pgTable(
  "meeting_occurrence_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    occurrenceDate: timestamp("occurrence_date", { withTimezone: true }).notNull(),
    status: meetingOccurrenceExceptionStatusEnum("status").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    title: text("title"),
    location: text("location"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("meeting_occurrence_exceptions_meeting_date_unique").on(table.meetingId, table.occurrenceDate),
    index("meeting_occurrence_exceptions_meeting_idx").on(table.meetingId),
  ],
);
