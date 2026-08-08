import { pgTable, uuid, text, boolean, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("meetings_org_idx").on(table.orgId),
    index("meetings_contact_idx").on(table.contactId),
    index("meetings_org_start_idx").on(table.orgId, table.startAt),
  ],
);
