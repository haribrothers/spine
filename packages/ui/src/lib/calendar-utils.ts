import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  isBefore,
  startOfDay,
} from "date-fns";

/**
 * Fixed category palette — see docs/DESIGN.md's "Event categories" entry
 * and the `category-*`/`category-*-bg` tokens in tailwind-preset.css.
 * Deliberately a separate token layer from the financial-status palette
 * (paid/due-soon/overdue/draft) even where hues overlap, since an event's
 * color is a free user label, not a system-derived fact.
 */
export const CALENDAR_EVENT_COLORS = [
  "blue",
  "green",
  "amber",
  "red",
  "purple",
  "teal",
  "pink",
  "slate",
] as const;

export type CalendarEventColor = (typeof CALENDAR_EVENT_COLORS)[number];

export type CalendarRecurrenceFrequency = "daily" | "weekly" | "monthly";

export type CalendarRecurrenceEnd = { type: "date"; date: Date } | { type: "count"; count: number };

export interface CalendarRecurrenceRule {
  frequency: CalendarRecurrenceFrequency;
  /** Repeat every N units (every 2 weeks, etc). Defaults to 1. */
  interval?: number;
  end: CalendarRecurrenceEnd;
}

/**
 * PRD S-01.14 — a single occurrence of a recurring event diverging from its
 * series' `recurrence` rule. `occurrenceDate` is the occurrence's
 * *unmodified* computed start (the date the rule would have produced before
 * any override) — the stable key an exception attaches to, matched against
 * each candidate occurrence's own computed `occurrenceStart` during
 * expansion, below. A `cancelled` exception carries no overrides (nothing to
 * override — the occurrence just shouldn't render); a `modified` exception's
 * override fields replace the corresponding computed value only where
 * present, falling back to the series' own value otherwise.
 */
export interface CalendarEventOccurrenceException {
  occurrenceDate: Date;
  status: "modified" | "cancelled";
  start?: Date;
  end?: Date;
  title?: string;
  location?: string;
  description?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color: CalendarEventColor;
  description?: string;
  location?: string;
  recurrence?: CalendarRecurrenceRule;
  /** Optional link to an external "contact" record — Calendar has no opinion on what a contact is, only an id/label pair supplied via CalendarProps.contactOptions. Omit both if the consuming app has no contact concept. */
  contactId?: string;
  /** PRD S-01.14 — per-occurrence overrides/cancellations for a recurring event. Meaningless (ignored) on a non-recurring event. */
  occurrenceExceptions?: CalendarEventOccurrenceException[];
}

/**
 * A concrete, on-the-calendar occurrence of a CalendarEvent. Non-recurring
 * events produce exactly one instance (occurrenceStart === event.start).
 * Recurring events produce one instance per expanded occurrence, each
 * carrying occurrenceStart/occurrenceEnd so day/week/month grids can place
 * it without mutating the original event's start/end.
 */
export interface CalendarEventInstance {
  event: CalendarEvent;
  /** Stable per-occurrence key: `${event.id}::${originalOccurrenceStart.toISOString()}`. */
  instanceId: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  isRecurring: boolean;
  /**
   * PRD S-01.14 — the occurrence's UNMODIFIED, series-computed start (what
   * the recurrence rule alone would have produced, before any exception
   * override). `occurrenceStart` above may differ from this once a
   * `modified` exception overrides the displayed time — but
   * `originalOccurrenceStart` is the stable key that exception is (and any
   * future edit to "this event" must be) keyed on, matching
   * `meeting_occurrence_exceptions.occurrence_date`. Equal to
   * `occurrenceStart` whenever no time override exists (including every
   * non-recurring instance).
   */
  originalOccurrenceStart: Date;
}

function stepInterval(rule: CalendarRecurrenceRule): number {
  return rule.interval && rule.interval > 0 ? rule.interval : 1;
}

function advance(date: Date, rule: CalendarRecurrenceRule): Date {
  const step = stepInterval(rule);
  switch (rule.frequency) {
    case "daily":
      return addDays(date, step);
    case "weekly":
      return addWeeks(date, step);
    case "monthly":
      return addMonths(date, step);
  }
}

/**
 * Expands a single CalendarEvent into concrete occurrences overlapping
 * [rangeStart, rangeEnd] (inclusive). Non-recurring events return zero or
 * one instance. Recurring events walk forward from event.start applying
 * the rule's frequency/interval via date-fns (which owns month-length and
 * DST-transition arithmetic — this function never does calendar math by
 * hand), stopping at the end condition (a fixed date, or an occurrence
 * count), and short-circuiting once occurrences pass rangeEnd since rules
 * are always forward-only and monotonically increasing in start date.
 *
 * A hard cap (MAX_OCCURRENCES) guards against pathological rules (e.g. a
 * daily recurrence with a count of 100000) blowing up a render.
 */
const MAX_OCCURRENCES = 2000;

export function expandRecurringEvent(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEventInstance[] {
  const duration = event.end.getTime() - event.start.getTime();
  const instances: CalendarEventInstance[] = [];

  if (!event.recurrence) {
    const overlaps = event.start <= rangeEnd && event.end >= rangeStart;
    if (overlaps) {
      instances.push({
        event,
        instanceId: `${event.id}::${event.start.toISOString()}`,
        occurrenceStart: event.start,
        occurrenceEnd: event.end,
        isRecurring: false,
        originalOccurrenceStart: event.start,
      });
    }
    return instances;
  }

  const rule = event.recurrence;
  let occurrenceStart = event.start;
  let count = 0;

  const hardEndDate = rule.end.type === "date" ? rule.end.date : null;
  const hardCount = rule.end.type === "count" ? rule.end.count : Infinity;
  const exceptionsByDate = new Map(
    (event.occurrenceExceptions ?? []).map((exception) => [exception.occurrenceDate.getTime(), exception]),
  );

  while (count < hardCount && count < MAX_OCCURRENCES) {
    if (hardEndDate && isBefore(hardEndDate, occurrenceStart)) break;
    if (isBefore(rangeEnd, occurrenceStart)) break;

    const exception = exceptionsByDate.get(occurrenceStart.getTime());
    const computedEnd = new Date(occurrenceStart.getTime() + duration);

    if (exception?.status === "cancelled") {
      // Skip emitting this instance — still advance/count normally, since
      // the occurrence still "happened" for recurrence-counting purposes,
      // it's just hidden from render.
      count += 1;
      occurrenceStart = advance(occurrenceStart, rule);
      continue;
    }

    const instanceStart = exception?.start ?? occurrenceStart;
    const instanceEnd = exception?.end ?? computedEnd;

    if (instanceEnd >= rangeStart) {
      // A modified exception's event-level overrides apply only to this one
      // instance — shallow-clone rather than mutate the shared series
      // `event` object, so other instances (and the series itself) are
      // never affected by one occurrence's override.
      const instanceEvent =
        exception?.status === "modified" && (exception.title !== undefined || exception.location !== undefined || exception.description !== undefined)
          ? {
              ...event,
              ...(exception.title !== undefined ? { title: exception.title } : {}),
              ...(exception.location !== undefined ? { location: exception.location } : {}),
              ...(exception.description !== undefined ? { description: exception.description } : {}),
            }
          : event;

      instances.push({
        event: instanceEvent,
        instanceId: `${event.id}::${occurrenceStart.toISOString()}`,
        occurrenceStart: instanceStart,
        occurrenceEnd: instanceEnd,
        isRecurring: true,
        originalOccurrenceStart: occurrenceStart,
      });
    }

    count += 1;
    occurrenceStart = advance(occurrenceStart, rule);
  }

  return instances;
}

/**
 * PRD S-01.14 — true when this specific occurrence already has a `modified`
 * exception (i.e. it was previously edited as "this event"). Used to skip
 * the This event/All events prompt on a *second* edit of an
 * already-individually-modified occurrence — at that point the user has
 * already committed to "just this one," so asking again is a false choice,
 * not a real one. A `cancelled` exception doesn't count (nothing to
 * re-edit; the occurrence is hidden), and a non-recurring event has no
 * exceptions to check. Takes the series event + the occurrence's stable key
 * directly (rather than a full CalendarEventInstance) so both the
 * click-edit path (which has an instance) and the drag path (which only
 * has the series CalendarEvent + a separately-tracked originalOccurrenceStart)
 * can share one implementation.
 */
export function isOccurrenceAlreadyModified(
  event: CalendarEvent,
  originalOccurrenceStart: Date,
  isRecurring: boolean,
): boolean {
  if (!isRecurring) return false;
  const key = originalOccurrenceStart.getTime();
  return (event.occurrenceExceptions ?? []).some(
    (exception) => exception.status === "modified" && exception.occurrenceDate.getTime() === key,
  );
}

/** Expands every event in `events` and flattens into occurrences overlapping the range, sorted by start time. */
export function expandEventsInRange(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEventInstance[] {
  const all = events.flatMap((event) => expandRecurringEvent(event, rangeStart, rangeEnd));
  return all.sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
}

/**
 * Overlap-layout: given the events visible on one day/column, assigns
 * each a horizontal slot index and the total slot count so overlapping
 * events render side-by-side (Outlook/Google Calendar style) instead of
 * stacking illegibly.
 *
 * Algorithm: sort by start (ties broken by longer duration first so wide
 * events claim column 0), then greedily assign each event the
 * lowest-numbered column whose previously-placed event has already
 * ended. Events sharing any overlap cluster all report the same
 * `columnCount` (the cluster's peak concurrency), so a lone event in a
 * cluster with a busy neighbor still renders at the shared fractional
 * width rather than assuming it's alone — this mirrors how Google
 * Calendar widens a lone slot's sibling once any overlap appears, but
 * keeps the algorithm a single pass with no backtracking.
 */
export interface CalendarLayoutSlot {
  instance: CalendarEventInstance;
  column: number;
  columnCount: number;
}

export function layoutOverlappingEvents(instances: CalendarEventInstance[]): CalendarLayoutSlot[] {
  if (instances.length === 0) return [];

  const sorted = [...instances].sort((a, b) => {
    const startDiff = a.occurrenceStart.getTime() - b.occurrenceStart.getTime();
    if (startDiff !== 0) return startDiff;
    const aDuration = a.occurrenceEnd.getTime() - a.occurrenceStart.getTime();
    const bDuration = b.occurrenceEnd.getTime() - b.occurrenceStart.getTime();
    return bDuration - aDuration;
  });

  // columnEndTimes[i] = end time of the event currently occupying column i
  const columnEndTimes: number[] = [];
  const columnOf = new Map<string, number>();

  // Cluster tracking: a cluster is a maximal run of mutually-connected
  // (transitively overlapping) events. clusterMembers groups instanceIds;
  // clusterMaxColumn tracks the peak column index seen in that cluster.
  let clusterMembers: string[] = [];
  let clusterMaxColumn = 0;
  let clusterEndTime = -Infinity;
  const results: CalendarLayoutSlot[] = [];
  const finalized: { instanceId: string; column: number }[] = [];

  const flushCluster = () => {
    const columnCount = clusterMaxColumn + 1;
    for (const member of finalized) {
      results.push({
        instance: instances.find((i) => i.instanceId === member.instanceId) as CalendarEventInstance,
        column: member.column,
        columnCount,
      });
    }
    finalized.length = 0;
    clusterMembers = [];
    clusterMaxColumn = 0;
  };

  for (const instance of sorted) {
    const start = instance.occurrenceStart.getTime();
    const end = instance.occurrenceEnd.getTime();

    if (start >= clusterEndTime && clusterMembers.length > 0) {
      // No overlap with the running cluster — close it out and start fresh.
      flushCluster();
      columnEndTimes.length = 0;
      clusterEndTime = -Infinity;
    }

    // Find the first column whose occupant has already ended by `start`.
    let column = columnEndTimes.findIndex((endTime) => endTime <= start);
    if (column === -1) {
      column = columnEndTimes.length;
      columnEndTimes.push(end);
    } else {
      columnEndTimes[column] = end;
    }

    columnOf.set(instance.instanceId, column);
    finalized.push({ instanceId: instance.instanceId, column });
    clusterMembers.push(instance.instanceId);
    clusterMaxColumn = Math.max(clusterMaxColumn, column);
    clusterEndTime = Math.max(clusterEndTime, end);
  }
  flushCluster();

  return results;
}

export function eventSpansMultipleDays(instance: CalendarEventInstance): boolean {
  return differenceInCalendarDays(startOfDay(instance.occurrenceEnd), startOfDay(instance.occurrenceStart)) > 0;
}

export function isInstanceWithinDay(instance: CalendarEventInstance, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return instance.occurrenceStart < dayEnd && instance.occurrenceEnd > dayStart;
}
