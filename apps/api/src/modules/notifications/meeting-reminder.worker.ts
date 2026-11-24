import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { meetingAttendees, meetings, user } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { SettingsService } from "../org/settings.service";
import { NotificationsService } from "./notifications.service";

export const MEETING_REMINDER_QUEUE = "meeting-starting-soon-poll";
/** PRD S-10.21 — "short fixed interval," concretely every 5 minutes. */
const POLL_CRON = "*/5 * * * *";
/** Falls back to this when neither the responding user nor the org has set a lead time (S-10.22's three-tier resolution). */
const HARDCODED_FALLBACK_MINUTES = 15;
/** How far ahead to prefetch meetings — must exceed the largest realistic lead-time override so late reminders never get missed by an under-sized prefetch window. */
const PREFETCH_WINDOW_HOURS = 24;

type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  end: { type: "date"; date: string } | { type: "count"; count: number };
};

/**
 * The first genuinely time-triggered (not action-triggered) job in this
 * codebase — every other queued job fires as the immediate side effect of
 * a business action; this one fires because a clock reached a threshold.
 * Polling on a short fixed interval (see POLL_CRON) rather than scheduling
 * a one-shot job per meeting at creation time: a one-shot-per-meeting
 * approach would need to be rescheduled or cancelled every time a
 * meeting's time changes, an attendee is added/removed, or the meeting is
 * deleted — a poll sidesteps all of that by just re-checking current state
 * each tick.
 *
 * PRD S-01.10 recurring meetings apply attendees to the whole series, but
 * S-10.21 reminders must still fire before EVERY occurrence, not just the
 * first ever — see meetingAttendees' `remindedForOccurrenceStart` column
 * comment (apps/api/src/db/schema/meetings.ts) for the mechanism: this
 * worker computes each meeting's next-upcoming occurrence start and only
 * treats an attendee as "already reminded" if `remindedForOccurrenceStart`
 * matches that specific occurrence, not merely "reminded_at is set."
 */
@Injectable()
export class MeetingReminderWorker implements OnModuleInit {
  private readonly logger = new Logger(MeetingReminderWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(MEETING_REMINDER_QUEUE, POLL_CRON);
    await this.queue.work(MEETING_REMINDER_QUEUE, async () => {
      await this.tick(new Date());
    });
  }

  /** Core logic, parameterized on `now` for testability — never call `new Date()` below this point. */
  async tick(now: Date): Promise<void> {
    const prefetchEnd = new Date(now.getTime() + PREFETCH_WINDOW_HOURS * 60 * 60 * 1000);

    const nonRecurringCandidates = await this.db
      .select()
      .from(meetings)
      .where(and(gte(meetings.endAt, now), lte(meetings.startAt, prefetchEnd), isNull(meetings.recurrence)));

    // A recurring series' own `startAt` is only its FIRST occurrence, which
    // may be long past — the prefetch-window filter above can't apply to
    // recurring meetings the same way, so every recurring meeting is
    // fetched unconditionally and nextOccurrenceStart() below does the
    // real work of finding (and bounding) its next occurrence. Recurring
    // meetings are a small subset of all meetings in practice, so an
    // unfiltered scan here is acceptable.
    const recurringMeetings = await this.db.select().from(meetings).where(isNotNull(meetings.recurrence));

    const byId = new Map(nonRecurringCandidates.map((m) => [m.id, m]));
    for (const m of recurringMeetings) byId.set(m.id, m);

    for (const meeting of byId.values()) {
      const occurrenceStart = this.nextOccurrenceStart(meeting, now);
      if (!occurrenceStart || occurrenceStart > prefetchEnd) continue;

      const attendees = await this.db
        .select()
        .from(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, meeting.id),
            inArray(meetingAttendees.status, ["accepted", "tentative"]),
          ),
        );

      for (const attendee of attendees) {
        if (!attendee.userId) continue;
        if (
          attendee.remindedForOccurrenceStart &&
          attendee.remindedForOccurrenceStart.getTime() === occurrenceStart.getTime()
        ) {
          continue; // already reminded for this specific occurrence
        }

        const leadMinutes = await this.resolveLeadMinutes(meeting.orgId, attendee.userId);
        const dueAt = new Date(occurrenceStart.getTime() - leadMinutes * 60 * 1000);
        if (now < dueAt || now > occurrenceStart) continue;

        // Idempotency guard against overlapping ticks: the WHERE clause
        // re-checks that remindedForOccurrenceStart still doesn't match
        // this occurrence at UPDATE time (not just when we read it above),
        // so only the first tick to reach this row for this occurrence
        // actually performs the write and sends the notification.
        const updated = await this.db
          .update(meetingAttendees)
          .set({ remindedAt: now, remindedForOccurrenceStart: occurrenceStart })
          .where(
            and(
              eq(meetingAttendees.id, attendee.id),
              or(isNull(meetingAttendees.remindedForOccurrenceStart), ne(meetingAttendees.remindedForOccurrenceStart, occurrenceStart)),
            ),
          )
          .returning();
        if (!updated.length) continue;

        void this.notifications.notify(meeting.orgId, {
          subject: `Starting soon: ${meeting.title}`,
          text: `"${meeting.title}" starts at ${occurrenceStart.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.`,
          recipientUserIds: [attendee.userId],
          inApp: {
            type: "meeting_starting_soon",
            message: `"${meeting.title}" starts soon.`,
            link: `/meetings?id=${meeting.id}`,
          },
        });
      }
    }
  }

  /** User override → org default → hardcoded fallback (S-10.22). */
  private async resolveLeadMinutes(orgId: string, userId: string): Promise<number> {
    const [row] = await this.db.select({ minutes: user.meetingReminderLeadMinutes }).from(user).where(eq(user.id, userId));
    if (row?.minutes != null) return row.minutes;

    const orgDefault = await this.settings.get<{ minutes: number }>(orgId, "meeting_reminder_lead_minutes");
    if (orgDefault?.minutes != null) return orgDefault.minutes;

    return HARDCODED_FALLBACK_MINUTES;
  }

  /**
   * The next occurrence start at or after `now`, or the meeting's own
   * `startAt` for non-recurring meetings (which IS "the occurrence").
   * Minimal, self-contained stepping (no date-fns dependency in this
   * package) — sufficient for "find the next occurrence," which only
   * needs forward stepping, not full range expansion. Mirrors
   * @spine/ui's calendar-utils.ts semantics (interval defaults to 1,
   * "date" end is inclusive, "count" end caps total occurrences) without
   * duplicating its full expansion machinery, since this worker only ever
   * needs the single next occurrence, not a list.
   */
  private nextOccurrenceStart(meeting: typeof meetings.$inferSelect, now: Date): Date | null {
    if (!meeting.recurrence) {
      // A reminder is only meaningful before the meeting starts — a
      // mid-meeting endAt >= now with startAt already passed is not "the
      // next occurrence," it's the current one already underway.
      return meeting.startAt >= now ? meeting.startAt : null;
    }
    const rule = meeting.recurrence as RecurrenceRule;
    const step = rule.interval && rule.interval > 0 ? rule.interval : 1;
    const hardEndDate = rule.end.type === "date" ? new Date(rule.end.date) : null;
    const hardCount = rule.end.type === "count" ? rule.end.count : Infinity;

    let occurrenceStart = meeting.startAt;
    let count = 0;
    const MAX_OCCURRENCES = 2000;

    while (count < hardCount && count < MAX_OCCURRENCES) {
      if (hardEndDate && occurrenceStart > hardEndDate) return null;
      if (occurrenceStart >= now) return occurrenceStart;

      count += 1;
      occurrenceStart = this.advance(occurrenceStart, rule.frequency, step);
    }
    return null;
  }

  private advance(date: Date, frequency: RecurrenceRule["frequency"], step: number): Date {
    const next = new Date(date);
    switch (frequency) {
      case "daily":
        next.setDate(next.getDate() + step);
        break;
      case "weekly":
        next.setDate(next.getDate() + step * 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + step);
        break;
    }
    return next;
  }
}
