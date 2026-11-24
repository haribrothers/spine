import { addDays, addMinutes, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isSameWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { expandEventsInRange, miniCalendarDayKey, type CalendarEvent, type CalendarView } from "@spine/ui";
import { t } from "../../../lib/i18n";

const VIEWS: CalendarView[] = ["day", "week", "month", "agenda"];
export const DEFAULT_VIEW: CalendarView = "week";
/** Agenda and Upcoming look this far ahead (D-212). */
export const UPCOMING_DAYS = 60;
export const UPCOMING_LIMIT = 8;

export function isCalendarView(value: string | null | undefined): value is CalendarView {
  return VIEWS.includes(value as CalendarView);
}

/** A local date from YYYY-MM-DD, or null. */
export function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** US-MTG-16 — the view and date from the address (either may be missing). */
export function parseCalendarParams(params: URLSearchParams): { view: CalendarView | null; date: Date | null } {
  const view = params.get("view");
  return { view: isCalendarView(view) ? view : null, date: parseDay(params.get("date")) };
}

/** The query for a view and date; the default view and today are left out, so `/meetings` is the plain calendar. */
export function calendarQuery(view: CalendarView, date: Date, today: Date): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_VIEW) params.set("view", view);
  if (!isSameDay(date, today)) params.set("date", miniCalendarDayKey(date));
  return params.toString();
}

/** US-MTG-17 — under 768 px there's no Week (a week doesn't fit); an address asking for it shows Day. */
export function viewForWidth(view: CalendarView, narrow: boolean): CalendarView {
  return narrow && view === "week" ? "day" : view;
}

/** The range the calendar heading shows, start and end inclusive, by day. */
export function visibleRange(view: CalendarView, date: Date): { start: Date; end: Date } {
  switch (view) {
    case "day":
      return { start: startOfDay(date), end: startOfDay(date) };
    case "week":
      return { start: startOfWeek(date), end: startOfDay(endOfWeek(date)) };
    case "month":
      return { start: startOfMonth(date), end: startOfDay(endOfMonth(date)) };
    case "agenda":
      return { start: startOfDay(date), end: addDays(startOfDay(date), UPCOMING_DAYS - 1) };
  }
}

/** The label beside "Meetings by contact" (US-MTG-15). */
export function rangeLabel(view: CalendarView, date: Date, today: Date): string {
  switch (view) {
    case "day":
      return isSameDay(date, today) ? t("meetings.range.today") : format(date, "EEE d MMM");
    case "week":
      return isSameWeek(date, today) ? t("meetings.range.thisWeek") : t("meetings.range.weekOf", { date: format(startOfWeek(date), "d MMM") });
    case "month":
      return isSameMonth(date, today) ? t("meetings.range.thisMonth") : format(date, "MMMM yyyy");
    case "agenda":
      return t("meetings.range.from", { date: format(date, "d MMM") });
  }
}

/** US-MTG-13 — how many occurrences fall on each day from `start` to `end` (inclusive); an event spanning days counts on each. */
export function countByDay(events: CalendarEvent[], start: Date, end: Date): Map<string, number> {
  const counts = new Map<string, number>();
  const rangeStart = startOfDay(start);
  const rangeEnd = addDays(startOfDay(end), 1);
  for (const instance of expandEventsInRange(events, rangeStart, rangeEnd)) {
    const last = new Date(Math.max(instance.occurrenceStart.getTime(), instance.occurrenceEnd.getTime() - 1));
    for (let day = startOfDay(instance.occurrenceStart); day <= last; day = addDays(day, 1)) {
      if (day < rangeStart || day >= rangeEnd) continue;
      const key = miniCalendarDayKey(day);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/** The days the mini calendar shows for a month (its whole weeks). */
export function monthGrid(month: Date): { start: Date; end: Date } {
  return { start: startOfWeek(startOfMonth(month)), end: startOfDay(endOfWeek(endOfMonth(month))) };
}

/** US-MTG-15 — "Today · 1:00 PM", "Tomorrow · 9:00 AM", "Tue 13 Oct · 2:30 PM", "Fri 16 Oct · All day". */
export function upcomingLabel(start: Date, allDay: boolean, now: Date): string {
  const day = isSameDay(start, now) ? t("meetings.upcoming.today") : isSameDay(start, addDays(now, 1)) ? t("meetings.upcoming.tomorrow") : format(start, "EEE d MMM");
  return `${day} · ${allDay ? t("meetings.upcoming.allDay") : format(start, "h:mm a")}`;
}

/** US-MTG-14 — New meeting: 30 minutes from the next half hour today, or from 9:00 AM on the shown day. */
export function newMeetingRange(shown: Date, now: Date): { start: Date; end: Date } {
  let start: Date;
  if (isSameDay(shown, now)) {
    start = new Date(now);
    start.setSeconds(0, 0);
    start = addMinutes(start, 30 - (start.getMinutes() % 30));
  } else {
    start = new Date(shown.getFullYear(), shown.getMonth(), shown.getDate(), 9, 0, 0, 0);
  }
  return { start, end: addMinutes(start, 30) };
}
