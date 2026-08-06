import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  isBefore,
  isEqual,
  isWithinInterval,
  max as maxDate,
  min as minDate,
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
  /** Stable per-occurrence key: `${event.id}::${occurrenceStart.toISOString()}`. */
  instanceId: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  isRecurring: boolean;
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
      });
    }
    return instances;
  }

  const rule = event.recurrence;
  let occurrenceStart = event.start;
  let count = 0;

  const hardEndDate = rule.end.type === "date" ? rule.end.date : null;
  const hardCount = rule.end.type === "count" ? rule.end.count : Infinity;

  while (count < hardCount && count < MAX_OCCURRENCES) {
    if (hardEndDate && isBefore(hardEndDate, occurrenceStart)) break;
    if (isBefore(rangeEnd, occurrenceStart)) break;

    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
    if (occurrenceEnd >= rangeStart) {
      instances.push({
        event,
        instanceId: `${event.id}::${occurrenceStart.toISOString()}`,
        occurrenceStart,
        occurrenceEnd,
        isRecurring: true,
      });
    }

    count += 1;
    occurrenceStart = advance(occurrenceStart, rule);
  }

  return instances;
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

/** Snaps a Date's time-of-day to the nearest multiple of `minutes` (used while dragging to create/move/resize). */
export function snapToMinutes(date: Date, minutes: number): Date {
  const ms = minutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

export function clampDate(date: Date, low: Date, high: Date): Date {
  return maxDate([low, minDate([high, date])]);
}

export function eventSpansMultipleDays(instance: CalendarEventInstance): boolean {
  return differenceInCalendarDays(startOfDay(instance.occurrenceEnd), startOfDay(instance.occurrenceStart)) > 0;
}

export function isInstanceWithinDay(instance: CalendarEventInstance, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return instance.occurrenceStart < dayEnd && instance.occurrenceEnd > dayStart;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function isSameInstant(a: Date, b: Date): boolean {
  return isEqual(a, b);
}

export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  return isWithinInterval(date, { start, end });
}
