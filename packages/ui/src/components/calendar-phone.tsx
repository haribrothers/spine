"use client";

import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, setMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { colorClasses } from "../lib/calendar-colors";
import { expandEventsInRange, isInstanceWithinDay, type CalendarEvent, type CalendarEventInstance } from "../lib/calendar-utils";
import { useT } from "../lib/i18n";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

type View = "day" | "week" | "month" | "agenda";

const MONTH_YEAR = "MMMM yyyy";
const LONG_DAY = "EEEE d MMMM";
const TIME = "h:mm a";
const NARROW_WEEKDAY = "EEEEE";
const DAY_NUMBER = "d";
const SHORT_MONTH = "MMM";
/** Up to this many dots under a day. */
const MAX_DOTS = 3;
/** How far a finger has to travel sideways to count as a swipe. */
const SWIPE_PX = 50;

/**
 * US-MTG-18 — a sideways swipe on a phone: left calls `onNext`, right `onPrevious`. A mostly
 * vertical drag (scrolling) is left alone. The area gets `touch-action: pan-y` so the browser
 * hands sideways movement to us. The arrows do the same for keyboard and switch users.
 */
export function useSwipe(onPrevious: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    style: { touchAction: "pan-y" } as React.CSSProperties,
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext();
      else onPrevious();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/** The events on `day`, earliest first. */
function dayInstances(instances: CalendarEventInstance[], day: Date) {
  return instances.filter((i) => isInstanceWithinDay(i, day)).sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
}

/** Up to three dots in the events' colours, for a day in the month or the week strip. */
function Dots({ instances }: { instances: CalendarEventInstance[] }) {
  return (
    <span aria-hidden className="flex h-1.5 items-center justify-center gap-[3px]">
      {instances.slice(0, MAX_DOTS).map((i) => (
        <span key={i.instanceId} className={cn("h-1.5 w-1.5 rounded-full", colorClasses(i.event.color).dot)} />
      ))}
    </span>
  );
}

/** A day's number in its circle: filled when chosen, ringed when it's today. */
function dayNumberClass(day: Date, selected: Date, inMonth = true) {
  return cn(
    "flex h-9 w-9 items-center justify-center rounded-full text-[16px] tabular-nums",
    isSameDay(day, selected) ? "bg-primary font-semibold text-on-primary" : isToday(day) ? "font-semibold text-primary ring-1 ring-inset ring-primary" : inMonth ? "text-on-surface" : "text-on-surface-muted",
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

/**
 * US-MTG-18 — the calendar's toolbar on a phone, in two short rows: the month and year (tap to
 * pick another month), the previous and next arrows and Today; then the views as a segmented
 * control the width of the screen.
 */
export function CalendarPhoneToolbar({
  date,
  view,
  views,
  viewLabels,
  onViewChange,
  onDateChange,
  onPrev,
  onNext,
  onToday,
}: {
  date: Date;
  view: View;
  views: View[];
  viewLabels: Record<View, string>;
  onViewChange: (view: View) => void;
  onDateChange: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [year, setYear] = useState(date.getFullYear());
  const arrow = "flex h-11 w-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-3 pt-1" data-calendar-phone-toolbar="">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setYear(date.getFullYear());
            setPicking(true);
          }}
          aria-haspopup="dialog"
          className="-ml-2 flex h-11 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-[18px] font-bold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="truncate">{format(date, MONTH_YEAR)}</span>
          <ChevronDown size={18} aria-hidden className="shrink-0" />
        </button>
        <button type="button" aria-label={t("ui.calendar.previous")} onClick={onPrev} className={arrow}>
          <ChevronLeft size={22} aria-hidden />
        </button>
        <button type="button" aria-label={t("ui.calendar.next")} onClick={onNext} className={arrow}>
          <ChevronRight size={22} aria-hidden />
        </button>
        <Button variant="secondary" onClick={onToday} className="px-3">
          {t("ui.calendar.today")}
        </Button>
      </div>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => value && onViewChange(value as View)}
        aria-label={t("ui.calendar.viewPicker")}
        className="grid w-full rounded-lg bg-surface-sunken p-1"
        style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}
      >
        {views.map((v) => (
          <ToggleGroupItem
            key={v}
            value={v}
            aria-label={t("ui.calendar.viewLabel", { view: viewLabels[v] })}
            className="h-11 rounded-md text-[15px] font-medium text-on-surface-muted hover:bg-transparent aria-checked:border-transparent aria-checked:bg-surface aria-checked:font-semibold aria-checked:text-on-surface aria-checked:shadow-sm"
          >
            {viewLabels[v]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <BottomSheet open={picking} onOpenChange={setPicking} title={t("ui.calendar.phone.pickMonth")}>
        <div className="flex items-center justify-between pb-3">
          <button type="button" aria-label={t("ui.calendar.phone.previousYear")} onClick={() => setYear((y) => y - 1)} className={arrow}>
            <ChevronLeft size={22} aria-hidden />
          </button>
          <span className="text-[17px] font-semibold tabular-nums text-on-surface">{year}</span>
          <button type="button" aria-label={t("ui.calendar.phone.nextYear")} onClick={() => setYear((y) => y + 1)} className={arrow}>
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, m) => {
            const month = setMonth(new Date(year, 0, 1), m);
            const chosen = year === date.getFullYear() && m === date.getMonth();
            return (
              <button
                key={m}
                type="button"
                aria-pressed={chosen}
                aria-label={format(month, MONTH_YEAR)}
                onClick={() => {
                  onDateChange(new Date(year, m, Math.min(date.getDate(), endOfMonth(month).getDate())));
                  setPicking(false);
                }}
                className={cn(
                  "h-12 rounded-md text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  chosen ? "bg-primary text-on-primary" : "bg-surface-sunken text-on-surface hover:bg-border",
                )}
              >
                {format(month, SHORT_MONTH)}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month: a compact grid with dots, and the chosen day's events under it
// ---------------------------------------------------------------------------

/**
 * US-MTG-18 — the month on a phone: one letter per weekday, today ringed, the chosen day filled,
 * up to three dots under a day with events (their count is in the day's name for screen
 * readers), and the chosen day's events listed under the grid. Tap a day to choose it; swipe the
 * grid, or use the toolbar's arrows, for the next or previous month. Arrow keys move the day.
 */
export function CalendarPhoneMonth({
  date,
  events,
  onDateChange,
  onEventClick,
  details,
}: {
  date: Date;
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  details?: (instance: CalendarEventInstance) => React.ReactNode;
}) {
  const t = useT();
  const gridStart = startOfWeek(startOfMonth(date));
  const gridEnd = endOfWeek(endOfMonth(date));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart.getTime(), gridEnd.getTime()]);
  const instances = useMemo(() => expandEventsInRange(events, gridStart, addDays(gridEnd, 1)), [events, gridStart.getTime(), gridEnd.getTime()]);
  const gridRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipe(
    () => onDateChange(addMonths(date, -1)),
    () => onDateChange(addMonths(date, 1)),
  );

  const choose = (day: Date, focus = false) => {
    onDateChange(day);
    if (focus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-day="${format(day, "yyyy-MM-dd")}"]`)?.focus());
  };

  return (
    <div className="flex flex-col">
      <div {...swipe} className="px-2 pb-2">
        <div className="grid grid-cols-7" aria-hidden>
          {days.slice(0, 7).map((day) => (
            <span key={day.toISOString()} className="py-1 text-center text-[12px] font-medium text-on-surface-muted">
              {format(day, NARROW_WEEKDAY)}
            </span>
          ))}
        </div>
        <div ref={gridRef} role="group" aria-label={format(date, MONTH_YEAR)} className="grid grid-cols-7 gap-y-1" data-testid="calendar-phone-month">
          {days.map((day) => {
            const list = dayInstances(instances, day);
            const inMonth = isSameMonth(day, date);
            const chosen = isSameDay(day, date);
            return (
              <button
                key={day.toISOString()}
                type="button"
                data-day={format(day, "yyyy-MM-dd")}
                tabIndex={chosen ? 0 : -1}
                aria-pressed={chosen}
                aria-current={isToday(day) ? "date" : undefined}
                aria-label={list.length ? t("ui.calendar.phone.dayLabel", { date: format(day, LONG_DAY), count: list.length }) : format(day, LONG_DAY)}
                onClick={() => choose(day)}
                onKeyDown={(e) => {
                  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                  if (step === undefined) return;
                  e.preventDefault();
                  choose(addDays(day, step), true);
                }}
                className="flex min-h-[52px] flex-col items-center gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                data-tap-area=""
              >
                <span className={dayNumberClass(day, date, inMonth)}>{format(day, DAY_NUMBER)}</span>
                <Dots instances={list} />
              </button>
            );
          })}
        </div>
      </div>
      <CalendarPhoneDayList date={date} instances={dayInstances(instances, date)} onEventClick={onEventClick} details={details} />
    </div>
  );
}

/** US-MTG-18 — a day's events as rows: the time (or All day), its colour, title, place and contact. */
function CalendarPhoneDayList({
  date,
  instances,
  onEventClick,
  details,
}: {
  date: Date;
  instances: CalendarEventInstance[];
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  details?: (instance: CalendarEventInstance) => React.ReactNode;
}) {
  const t = useT();
  const heading = isToday(date) ? t("ui.calendar.phone.today", { date: format(date, LONG_DAY) }) : format(date, LONG_DAY);
  return (
    <section aria-label={heading} className="border-t border-border" data-testid="calendar-phone-day-list">
      <div className="flex items-center justify-between gap-3 bg-surface-sunken px-4 py-2 text-[13px]">
        <span className="font-semibold text-on-surface">{heading}</span>
        <span className="text-on-surface-muted">{t("ui.calendar.phone.count", { count: instances.length })}</span>
      </div>
      {instances.length === 0 ? (
        <p className="px-4 py-6 text-center text-[14px] text-on-surface-muted">{t("ui.calendar.phone.nothing")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {instances.map((instance) => {
            const extra = details?.(instance);
            return (
              <li key={instance.instanceId}>
                <button
                  type="button"
                  data-instance-id={instance.instanceId}
                  onClick={(e) => onEventClick(instance, e.currentTarget)}
                  className="flex w-full items-stretch gap-3 px-4 py-3 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="flex w-[68px] shrink-0 flex-col text-[13px] tabular-nums">
                    {instance.event.allDay ? (
                      <span className="font-semibold text-on-surface">{t("ui.calendar.allDay")}</span>
                    ) : (
                      <>
                        <span className="font-semibold text-on-surface">{format(instance.occurrenceStart, TIME)}</span>
                        <span className="text-on-surface-muted">{format(instance.occurrenceEnd, TIME)}</span>
                      </>
                    )}
                  </span>
                  <span aria-hidden className={cn("w-1 shrink-0 rounded-full", colorClasses(instance.event.color).dot)} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold text-on-surface">{instance.event.title}</span>
                    {(instance.event.location || extra) && (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-on-surface-muted">
                        {instance.event.location && (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin size={12} aria-hidden className="shrink-0" />
                            <span className="truncate">{instance.event.location}</span>
                          </span>
                        )}
                        {extra}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Day: a week strip over the day's timeline
// ---------------------------------------------------------------------------

/**
 * US-MTG-18 — the week's seven days over the Day view on a phone, each with its dots; tap one to
 * show it, swipe the strip for the next or previous week. Under it, the day's name and how many
 * events it has (and how many are still to come today).
 */
export function CalendarWeekStrip({ date, events, onDateChange }: { date: Date; events: CalendarEvent[]; onDateChange: (date: Date) => void }) {
  const t = useT();
  const weekStart = startOfWeek(date);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: endOfWeek(date) }), [weekStart.getTime()]);
  const instances = useMemo(() => expandEventsInRange(events, weekStart, addDays(weekStart, 7)), [events, weekStart.getTime()]);
  const swipe = useSwipe(
    () => onDateChange(addWeeks(date, -1)),
    () => onDateChange(addWeeks(date, 1)),
  );
  const today = dayInstances(instances, date);
  const now = new Date();
  const later = isToday(date) ? today.filter((i) => i.occurrenceStart > now).length : 0;
  return (
    <div className="flex flex-col border-b border-border">
      <div {...swipe} role="group" aria-label={t("ui.calendar.phone.week", { date: format(weekStart, LONG_DAY) })} className="grid grid-cols-7 px-2 pb-2" data-testid="calendar-week-strip">
        {days.map((day) => {
          const list = dayInstances(instances, day);
          const chosen = isSameDay(day, date);
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={chosen}
              aria-current={isToday(day) ? "date" : undefined}
              aria-label={list.length ? t("ui.calendar.phone.dayLabel", { date: format(day, LONG_DAY), count: list.length }) : format(day, LONG_DAY)}
              onClick={() => onDateChange(day)}
              className="flex flex-col items-center gap-0.5 rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              data-tap-area=""
            >
              <span aria-hidden className="text-[12px] font-medium text-on-surface-muted">
                {format(day, NARROW_WEEKDAY)}
              </span>
              <span className={dayNumberClass(day, date)}>{format(day, DAY_NUMBER)}</span>
              <Dots instances={list} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-[13px]">
        <span className="font-semibold text-on-surface">{format(date, LONG_DAY)}</span>
        <span className="text-on-surface-muted">
          {t("ui.calendar.phone.count", { count: today.length })}
          {later > 0 && ` · ${t("ui.calendar.phone.later", { count: later })}`}
        </span>
      </div>
    </div>
  );
}

/** US-MTG-18 — an event's quick view as a bottom sheet on a phone. The quick view has its own title and close, so the sheet shows only its grabber. */
export function CalendarQuickViewSheet({ instance, onClose, children }: { instance: CalendarEventInstance | null; onClose: () => void; children: React.ReactNode }) {
  return (
    <BottomSheet open={!!instance} onOpenChange={(open) => !open && onClose()} title={instance?.event.title ?? ""} hideHeader data-testid="calendar-quick-view-sheet">
      {children}
    </BottomSheet>
  );
}
