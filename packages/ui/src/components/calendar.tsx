"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, MapPin, Repeat, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
  CALENDAR_EVENT_COLORS,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarEventInstance,
  type CalendarLayoutSlot,
  type CalendarRecurrenceFrequency,
  eventSpansMultipleDays,
  expandEventsInRange,
  isInstanceWithinDay,
  layoutOverlappingEvents,
} from "../lib/calendar-utils";
import { Button } from "./button";
import { Combobox } from "./combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Field } from "./field";
import { Input } from "./input";
import { Label } from "./label";
import { MiniCalendar } from "./calendar-mini";
import { NativeSelect } from "./native-select";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Switch } from "./switch";
import { Textarea } from "./textarea";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export type { CalendarEvent, CalendarEventColor, CalendarRecurrenceRule, CalendarRecurrenceFrequency, CalendarRecurrenceEnd } from "../lib/calendar-utils";
export { CALENDAR_EVENT_COLORS } from "../lib/calendar-utils";

export type CalendarView = "day" | "week" | "month" | "agenda";

const HOUR_HEIGHT = 48; // px per hour in Day/Week grids
const SNAP_MINUTES = 15;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;

const COLOR_LABELS: Record<CalendarEventColor, string> = {
  blue: "Blue",
  green: "Green",
  amber: "Amber",
  red: "Red",
  purple: "Purple",
  teal: "Teal",
  pink: "Pink",
  slate: "Slate",
};

/**
 * Static per-color class lookup — not built via template-string
 * interpolation (`` `bg-category-${color}-bg` ``), since Tailwind's
 * content scanner can only pick up class names it can see as literal
 * text, not ones assembled at runtime (same pattern as layout.tsx's
 * paddingScale/gapScale).
 */
const COLOR_CLASSES: Record<CalendarEventColor, { bg: string; fg: string; dot: string; border: string }> = {
  blue: { bg: "bg-category-blue-bg", fg: "text-category-blue", dot: "bg-category-blue", border: "border-category-blue" },
  green: { bg: "bg-category-green-bg", fg: "text-category-green", dot: "bg-category-green", border: "border-category-green" },
  amber: { bg: "bg-category-amber-bg", fg: "text-category-amber", dot: "bg-category-amber", border: "border-category-amber" },
  red: { bg: "bg-category-red-bg", fg: "text-category-red", dot: "bg-category-red", border: "border-category-red" },
  purple: { bg: "bg-category-purple-bg", fg: "text-category-purple", dot: "bg-category-purple", border: "border-category-purple" },
  teal: { bg: "bg-category-teal-bg", fg: "text-category-teal", dot: "bg-category-teal", border: "border-category-teal" },
  pink: { bg: "bg-category-pink-bg", fg: "text-category-pink", dot: "bg-category-pink", border: "border-category-pink" },
  slate: { bg: "bg-category-slate-bg", fg: "text-category-slate", dot: "bg-category-slate", border: "border-category-slate" },
};

function colorClasses(color: CalendarEventColor) {
  return COLOR_CLASSES[color];
}

function newId(): string {
  return `evt_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Draft type used while dragging to create, move, or resize an event before
// it's committed via onEventCreate/onEventUpdate.
// ---------------------------------------------------------------------------

interface DraftRange {
  start: Date;
  end: Date;
}

export interface CalendarProps {
  events: CalendarEvent[];
  onEventCreate?: (event: CalendarEvent) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  /** When provided, the built-in event editor shows an optional "Contact" field (a searchable Combobox over these options) and round-trips the choice via CalendarEvent.contactId. Omit entirely for a calendar with no contact concept — the field simply doesn't render. */
  contactOptions?: { value: string; label: string }[];
  className?: string;
}

/**
 * Outlook-style scheduling calendar: Day/Week/Month/Agenda views, drag to
 * create/move/resize, recurrence, and side-by-side overlap layout. Fully
 * controlled — the caller owns `events`, `view`, and `date`; this component
 * never holds business data in local state, only interaction-in-progress
 * state (a drag/resize/create draft, and the event-editor's open instance).
 *
 * Recurrence expansion and overlap layout are pure functions in
 * calendar-utils.ts; this file is the React tree over them.
 */
export function Calendar({
  events,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  view,
  onViewChange,
  date,
  onDateChange,
  contactOptions,
  className,
}: CalendarProps) {
  const [editorState, setEditorState] = useState<
    | { mode: "create"; range: DraftRange; allDay?: boolean }
    | { mode: "edit"; instance: CalendarEventInstance }
    | null
  >(null);

  const goToday = () => onDateChange(new Date());
  const goPrev = () => onDateChange(stepDate(date, view, -1));
  const goNext = () => onDateChange(stepDate(date, view, 1));

  const handleSlotCreate = (range: DraftRange, allDay?: boolean) => {
    setEditorState({ mode: "create", range, allDay });
  };

  const handleEventClick = (instance: CalendarEventInstance) => {
    setEditorState({ mode: "edit", instance });
  };

  const handleSave = (result: CalendarEvent) => {
    if (editorState?.mode === "edit") {
      onEventUpdate?.(result);
    } else {
      onEventCreate?.(result);
    }
    setEditorState(null);
  };

  const handleDelete = (eventId: string) => {
    onEventDelete?.(eventId);
    setEditorState(null);
  };

  return (
    <div className={cn("flex h-full min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <CalendarToolbar
        view={view}
        onViewChange={onViewChange}
        date={date}
        onDateChange={onDateChange}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "day" && (
          <CalendarDayView
            date={date}
            events={events}
            onSlotCreate={handleSlotCreate}
            onEventClick={handleEventClick}
            onEventUpdate={(e) => onEventUpdate?.(e)}
          />
        )}
        {view === "week" && (
          <CalendarWeekView
            date={date}
            events={events}
            onSlotCreate={handleSlotCreate}
            onEventClick={handleEventClick}
            onEventUpdate={(e) => onEventUpdate?.(e)}
          />
        )}
        {view === "month" && (
          <CalendarMonthView
            date={date}
            events={events}
            onDayCreate={(day) => handleSlotCreate({ start: day, end: addDays(day, 1) }, true)}
            onEventClick={handleEventClick}
            onDateChange={onDateChange}
            onViewChange={onViewChange}
          />
        )}
        {view === "agenda" && (
          <CalendarAgendaView date={date} events={events} onEventClick={handleEventClick} />
        )}
      </div>

      <CalendarEventEditor
        state={editorState}
        onClose={() => setEditorState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        contactOptions={contactOptions}
      />
    </div>
  );
}

function stepDate(date: Date, view: CalendarView, direction: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(date, direction);
    case "week":
      return addWeeks(date, direction);
    case "month":
      return addMonths(date, direction);
    case "agenda":
      return addDays(date, direction * 7);
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function toolbarLabel(date: Date, view: CalendarView): string {
  switch (view) {
    case "day":
      return format(date, "EEEE, MMMM d, yyyy");
    case "week": {
      const start = startOfWeek(date);
      const end = endOfWeek(date);
      const sameMonth = isSameMonth(start, end);
      return sameMonth
        ? `${format(start, "MMMM d")} – ${format(end, "d, yyyy")}`
        : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    case "month":
      return format(date, "MMMM yyyy");
    case "agenda":
      return `Upcoming from ${format(date, "MMM d, yyyy")}`;
  }
}

function CalendarToolbar({ view, onViewChange, date, onDateChange, onPrev, onNext, onToday }: CalendarToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[15px] font-semibold text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {toolbarLabel(date, view)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start">
            <MiniCalendar
              selected={date}
              onSelect={(picked) => {
                onDateChange(picked);
                setPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => value && onViewChange(value as CalendarView)}
        aria-label="Calendar view"
        className="rounded-md border border-border p-0.5"
      >
        <ToggleGroupItem value="day" aria-label="Day view" className="h-8 px-3 text-[12.5px]">
          Day
        </ToggleGroupItem>
        <ToggleGroupItem value="week" aria-label="Week view" className="h-8 px-3 text-[12.5px]">
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="month" aria-label="Month view" className="h-8 px-3 text-[12.5px]">
          Month
        </ToggleGroupItem>
        <ToggleGroupItem value="agenda" aria-label="Agenda view" className="h-8 px-3 text-[12.5px]">
          Agenda
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: time grid (used by Day + Week views)
// ---------------------------------------------------------------------------

interface TimeGridDragState {
  kind: "create" | "move" | "resize-start" | "resize-end";
  dayIndex: number;
  instanceId?: string;
  originalEvent?: CalendarEvent;
  startY: number;
  currentStart: Date;
  currentEnd: Date;
  pointerId: number;
}

function yToMinutes(y: number, gridHeight: number): number {
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const ratio = Math.min(1, Math.max(0, y / gridHeight));
  return DAY_START_HOUR * 60 + ratio * totalMinutes;
}

function minutesToY(minutes: number, gridHeight: number): number {
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  return ((minutes - DAY_START_HOUR * 60) / totalMinutes) * gridHeight;
}

interface TimeGridProps {
  days: Date[];
  events: CalendarEvent[];
  onSlotCreate: (range: DraftRange, allDay?: boolean) => void;
  onEventClick: (instance: CalendarEventInstance) => void;
  onEventUpdate: (event: CalendarEvent) => void;
}

/**
 * Shared hour-grid rendering + pointer-driven drag-create/move/resize used
 * by both Day and Week views (Week is just N adjacent day columns sharing
 * one grid). Pointer events (not HTML5 DnD) drive all three interactions
 * so touch works and live feedback (the draft block following the pointer)
 * is simple to render — see calendar.tsx's module doc for why.
 */
function TimeGrid({ days, events, onSlotCreate, onEventClick, onEventUpdate }: TimeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<TimeGridDragState | null>(null);
  const dragRef = useRef<TimeGridDragState | null>(null);
  dragRef.current = drag;

  const rangeStart = startOfDay(days[0] ?? new Date());
  const rangeEnd = addDays(startOfDay(days[days.length - 1] ?? days[0] ?? new Date()), 1);

  const timedInstances = useMemo(
    () => expandEventsInRange(events, rangeStart, rangeEnd).filter((i) => !i.event.allDay && !eventSpansMultipleDays(i)),
    [events, rangeStart, rangeEnd],
  );
  const allDayInstances = useMemo(
    () => expandEventsInRange(events, rangeStart, rangeEnd).filter((i) => i.event.allDay || eventSpansMultipleDays(i)),
    [events, rangeStart, rangeEnd],
  );

  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dayAt = (index: number): Date => days[index] ?? days[0] ?? new Date();

  const beginCreate = (dayIndex: number, e: React.PointerEvent) => {
    const column = columnRefs.current[dayIndex];
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutesValue(yToMinutes(y, gridHeight));
    const dayBase = startOfDay(dayAt(dayIndex));
    const start = addMinutesTo(dayBase, minutes);
    const end = addMinutesTo(dayBase, minutes + SNAP_MINUTES);
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ kind: "create", dayIndex, startY: y, currentStart: start, currentEnd: end, pointerId: e.pointerId });
  };

  const beginMove = (instance: CalendarEventInstance, dayIndex: number, e: React.PointerEvent) => {
    e.stopPropagation();
    const column = columnRefs.current[dayIndex];
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const y = e.clientY - rect.top;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      kind: "move",
      dayIndex,
      instanceId: instance.instanceId,
      originalEvent: instance.event,
      startY: y,
      currentStart: instance.occurrenceStart,
      currentEnd: instance.occurrenceEnd,
      pointerId: e.pointerId,
    });
  };

  const beginResize = (instance: CalendarEventInstance, dayIndex: number, edge: "start" | "end", e: React.PointerEvent) => {
    e.stopPropagation();
    const column = columnRefs.current[dayIndex];
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const y = e.clientY - rect.top;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      kind: edge === "start" ? "resize-start" : "resize-end",
      dayIndex,
      instanceId: instance.instanceId,
      originalEvent: instance.event,
      startY: y,
      currentStart: instance.occurrenceStart,
      currentEnd: instance.occurrenceEnd,
      pointerId: e.pointerId,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      const column = columnRefs.current[drag.dayIndex];
      if (!column) return;
      const rect = column.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minutes = snapMinutesValue(yToMinutes(y, gridHeight));
      const dayBase = startOfDay(dayAt(drag.dayIndex));

      setDrag((prev) => {
        if (!prev) return prev;
        if (prev.kind === "create") {
          const startMinutes = snapMinutesValue(yToMinutes(prev.startY, gridHeight));
          const lo = Math.min(startMinutes, minutes);
          const hi = Math.max(startMinutes, minutes + SNAP_MINUTES);
          return { ...prev, currentStart: addMinutesTo(dayBase, lo), currentEnd: addMinutesTo(dayBase, Math.max(hi, lo + SNAP_MINUTES)) };
        }
        if (prev.kind === "move" && prev.originalEvent) {
          const duration = prev.originalEvent.end.getTime() - prev.originalEvent.start.getTime();
          const newStart = addMinutesTo(dayBase, minutes);
          return { ...prev, currentStart: newStart, currentEnd: new Date(newStart.getTime() + duration) };
        }
        if (prev.kind === "resize-start") {
          const newStart = addMinutesTo(dayBase, Math.min(minutes, snapMinutesValue(yToMinutes(minutesToY(diffMinutes(prev.currentEnd, dayBase), gridHeight) - SNAP_MINUTES, gridHeight))));
          const cappedStart = newStart < prev.currentEnd ? newStart : addMinutesTo(prev.currentEnd, -SNAP_MINUTES);
          return { ...prev, currentStart: cappedStart };
        }
        if (prev.kind === "resize-end") {
          const newEnd = addMinutesTo(dayBase, minutes);
          const cappedEnd = newEnd > prev.currentStart ? newEnd : addMinutesTo(prev.currentStart, SNAP_MINUTES);
          return { ...prev, currentEnd: cappedEnd };
        }
        return prev;
      });
    };

    const handleUp = () => {
      // Read the in-progress drag from the ref (kept in sync below) rather
      // than committing side effects inside the setDrag updater itself —
      // calling onSlotCreate/onEventUpdate (which set state on the parent
      // Calendar) from inside a setState updater can fire while React is
      // still rendering a different component, which React 19 flags.
      const finished = dragRef.current;
      setDrag(null);
      if (!finished) return;
      if (finished.kind === "create") {
        onSlotCreate({ start: finished.currentStart, end: finished.currentEnd });
      } else if (finished.originalEvent) {
        onEventUpdate({ ...finished.originalEvent, start: finished.currentStart, end: finished.currentEnd });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrag(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drag?.kind, drag?.dayIndex, gridHeight, days, onEventUpdate, onSlotCreate]);

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

  return (
    <div className="flex flex-col">
      {allDayInstances.length > 0 && (
        <div className="flex border-b border-border">
          <div className="w-16 shrink-0 border-r border-border px-2 py-1.5 text-[11px] font-medium text-on-surface-muted">
            All day
          </div>
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day) => {
              const dayInstances = allDayInstances.filter((i) => isInstanceWithinDay(i, day));
              return (
                <div key={day.toISOString()} className="min-h-9 border-r border-border p-1 last:border-r-0">
                  {dayInstances.map((instance) => {
                    const colors = colorClasses(instance.event.color);
                    return (
                      <button
                        key={instance.instanceId}
                        type="button"
                        onClick={() => onEventClick(instance)}
                        className={cn(
                          "mb-1 flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11.5px] font-medium",
                          colors.bg,
                          colors.fg,
                        )}
                      >
                        {instance.event.recurrence && <Repeat size={10} className="shrink-0" />}
                        <span className="truncate">{instance.event.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex">
        <div className="w-16 shrink-0">
          {hours.map((hour) => (
            <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative border-r border-border">
              <span className="absolute -top-2 right-1.5 text-[10.5px] text-on-surface-muted">
                {hour === 0 ? "" : format(new Date(2000, 0, 1, hour), "h a")}
              </span>
            </div>
          ))}
        </div>

        <div ref={gridRef} className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day, dayIndex) => {
            const dayInstances = timedInstances.filter((i) => isSameDay(i.occurrenceStart, day));
            const slots = layoutOverlappingEvents(dayInstances);
            const isDragDay = drag?.dayIndex === dayIndex;

            return (
              <div
                key={day.toISOString()}
                ref={(el) => {
                  columnRefs.current[dayIndex] = el;
                }}
                className={cn("relative border-r border-border last:border-r-0", isToday(day) && "bg-primary/5")}
                style={{ height: gridHeight }}
                onPointerDown={(e) => {
                  // Hour-row dividers and the empty column background should
                  // both start a create-drag; only bail out if the pointer
                  // actually landed on an event block (which stops
                  // propagation itself via onMoveStart/onResizeStart).
                  beginCreate(dayIndex, e);
                }}
              >
                {hours.map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="pointer-events-none border-b border-border" />
                ))}

                {slots.map((slot) => (
                  <TimeGridEvent
                    key={slot.instance.instanceId}
                    slot={slot}
                    gridHeight={gridHeight}
                    isDragging={drag?.instanceId === slot.instance.instanceId}
                    onEventClick={onEventClick}
                    onMoveStart={(e) => beginMove(slot.instance, dayIndex, e)}
                    onResizeStart={(edge, e) => beginResize(slot.instance, dayIndex, edge, e)}
                  />
                ))}

                {isDragDay && drag && (
                  <div
                    className="pointer-events-none absolute left-0.5 right-0.5 rounded border-2 border-primary bg-primary/15"
                    style={{
                      top: minutesToY(diffMinutes(drag.currentStart, startOfDay(day)), gridHeight),
                      height: Math.max(
                        4,
                        minutesToY(diffMinutes(drag.currentEnd, startOfDay(day)), gridHeight) -
                          minutesToY(diffMinutes(drag.currentStart, startOfDay(day)), gridHeight),
                      ),
                    }}
                  >
                    <span className="block truncate px-1 pt-0.5 text-[10.5px] font-medium text-primary">
                      {format(drag.currentStart, "h:mm a")} – {format(drag.currentEnd, "h:mm a")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function diffMinutes(date: Date, dayBase: Date): number {
  return (date.getTime() - dayBase.getTime()) / 60000;
}

function addMinutesTo(dayBase: Date, minutes: number): Date {
  return new Date(dayBase.getTime() + minutes * 60000);
}

function snapMinutesValue(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

interface TimeGridEventProps {
  slot: CalendarLayoutSlot;
  gridHeight: number;
  isDragging: boolean;
  onEventClick: (instance: CalendarEventInstance) => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (edge: "start" | "end", e: React.PointerEvent) => void;
}

function TimeGridEvent({ slot, gridHeight, isDragging, onEventClick, onMoveStart, onResizeStart }: TimeGridEventProps) {
  const { instance, column, columnCount } = slot;
  const dayBase = startOfDay(instance.occurrenceStart);
  const top = minutesToY(diffMinutes(instance.occurrenceStart, dayBase), gridHeight);
  const bottom = minutesToY(diffMinutes(instance.occurrenceEnd, dayBase), gridHeight);
  const height = Math.max(18, bottom - top);
  const width = 100 / columnCount;
  const left = width * column;
  const colors = colorClasses(instance.event.color);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${instance.event.title}, ${format(instance.occurrenceStart, "h:mm a")} to ${format(instance.occurrenceEnd, "h:mm a")}`}
      className={cn(
        "group absolute overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11.5px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        colors.bg,
        colors.fg,
        colors.border,
        isDragging && "opacity-60",
      )}
      style={{ top, height, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }}
      onPointerDown={onMoveStart}
      onClick={() => onEventClick(instance)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEventClick(instance);
        }
      }}
    >
      <div className="flex items-center gap-1 font-medium">
        {instance.event.recurrence && <Repeat size={10} className="shrink-0" />}
        <span className="truncate">{instance.event.title}</span>
      </div>
      {height > 32 && <span className="block truncate opacity-80">{format(instance.occurrenceStart, "h:mm a")}</span>}

      <div
        className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
        onPointerDown={(e) => onResizeStart("start", e)}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
        onPointerDown={(e) => onResizeStart("end", e)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

interface DayLikeViewProps {
  date: Date;
  events: CalendarEvent[];
  onSlotCreate: (range: DraftRange, allDay?: boolean) => void;
  onEventClick: (instance: CalendarEventInstance) => void;
  onEventUpdate: (event: CalendarEvent) => void;
}

function CalendarDayView({ date, events, onSlotCreate, onEventClick, onEventUpdate }: DayLikeViewProps) {
  return (
    <TimeGrid days={[date]} events={events} onSlotCreate={onSlotCreate} onEventClick={onEventClick} onEventUpdate={onEventUpdate} />
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function CalendarWeekView({ date, events, onSlotCreate, onEventClick, onEventUpdate }: DayLikeViewProps) {
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(date), end: endOfWeek(date) }), [date]);

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-border">
        <div className="w-16 shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => (
            <div key={day.toISOString()} className="border-r border-border px-2 py-2 text-center last:border-r-0">
              <div className="text-[11px] font-medium text-on-surface-muted">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold",
                  isToday(day) ? "bg-primary text-white" : "text-on-surface",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
      </div>
      <TimeGrid days={days} events={events} onSlotCreate={onSlotCreate} onEventClick={onEventClick} onEventUpdate={onEventUpdate} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

interface MonthViewProps {
  date: Date;
  events: CalendarEvent[];
  onDayCreate: (day: Date) => void;
  onEventClick: (instance: CalendarEventInstance) => void;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

function CalendarMonthView({ date, events, onDayCreate, onEventClick, onDateChange, onViewChange }: MonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);
  const weeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [days]);

  const instances = useMemo(() => expandEventsInRange(events, gridStart, addDays(gridEnd, 1)), [events, gridStart, gridEnd]);

  const [focusedDay, setFocusedDay] = useState<Date>(date);

  const moveFocus = (delta: number) => {
    setFocusedDay((prev) => {
      const next = addDays(prev, delta);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="border-r border-border px-2 py-1.5 text-center text-[11px] font-medium text-on-surface-muted last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid flex-1 grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const dayInstances = instances
                .filter((i) => isInstanceWithinDay(i, day))
                .sort((a, b) => a.occurrenceStart.getTime() - b.occurrenceStart.getTime());
              const visible = dayInstances.slice(0, MAX_VISIBLE_PER_DAY);
              const overflow = dayInstances.length - visible.length;
              const inMonth = isSameMonth(day, date);
              const isFocused = isSameDay(day, focusedDay);

              return (
                <div
                  key={day.toISOString()}
                  role="gridcell"
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={format(day, "EEEE, MMMM d, yyyy")}
                  className={cn(
                    "flex min-h-[92px] flex-col gap-0.5 border-r border-border p-1 text-left last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    !inMonth && "bg-surface-sunken/60",
                  )}
                  onClick={() => onDayCreate(day)}
                  onFocus={() => setFocusedDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); }
                    if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); }
                    if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(7); }
                    if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-7); }
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDayCreate(day); }
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Open ${format(day, "EEEE, MMMM d, yyyy")} in day view`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center self-start rounded-full text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isToday(day) ? "bg-primary text-white" : inMonth ? "text-on-surface" : "text-on-surface-muted",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateChange(day);
                      onViewChange("day");
                    }}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((instance) => {
                      const colors = colorClasses(instance.event.color);
                      return (
                        <button
                          key={instance.instanceId}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(instance);
                          }}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            colors.bg,
                            colors.fg,
                          )}
                        >
                          {instance.event.recurrence && <Repeat size={9} className="shrink-0" />}
                          {!instance.event.allDay && !eventSpansMultipleDays(instance) && (
                            <span className="shrink-0 opacity-75">{format(instance.occurrenceStart, "h:mma")}</span>
                          )}
                          <span className="truncate">{instance.event.title}</span>
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="px-1 text-[10.5px] font-medium text-on-surface-muted">+{overflow} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agenda view
// ---------------------------------------------------------------------------

interface AgendaViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (instance: CalendarEventInstance) => void;
}

const AGENDA_WINDOW_DAYS = 60;

function CalendarAgendaView({ date, events, onEventClick }: AgendaViewProps) {
  const rangeStart = startOfDay(date);
  const rangeEnd = addDays(rangeStart, AGENDA_WINDOW_DAYS);
  const instances = useMemo(() => expandEventsInRange(events, rangeStart, rangeEnd), [events, rangeStart, rangeEnd]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEventInstance[]>();
    for (const instance of instances) {
      const key = format(startOfDay(instance.occurrenceStart), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(instance);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [instances]);

  if (grouped.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-[13px] text-on-surface-muted">
        No upcoming events in the next {AGENDA_WINDOW_DAYS} days.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {grouped.map(([key, dayInstances]) => {
        const day = new Date(`${key}T00:00:00`);
        return (
          <div key={key} className="flex gap-4 px-4 py-3">
            <div className="w-24 shrink-0 pt-0.5">
              <div className="text-[12px] font-medium text-on-surface-muted">{format(day, "EEE")}</div>
              <div className={cn("text-[15px] font-semibold", isToday(day) ? "text-primary" : "text-on-surface")}>
                {format(day, "MMM d")}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {dayInstances.map((instance) => {
                const colors = colorClasses(instance.event.color);
                return (
                  <button
                    key={instance.instanceId}
                    type="button"
                    onClick={() => onEventClick(instance)}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colors.dot)} />
                    <span className="w-24 shrink-0 text-[12.5px] text-on-surface-muted">
                      {instance.event.allDay ? "All day" : format(instance.occurrenceStart, "h:mm a")}
                    </span>
                    <span className="truncate text-[13.5px] font-medium text-on-surface">{instance.event.title}</span>
                    {instance.event.recurrence && <Repeat size={12} className="shrink-0 text-on-surface-muted" />}
                    {instance.event.location && (
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-on-surface-muted">
                        <MapPin size={11} />
                        {instance.event.location}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event editor (Dialog-hosted create/edit form)
// ---------------------------------------------------------------------------

interface CalendarEventEditorProps {
  state:
    | { mode: "create"; range: DraftRange; allDay?: boolean }
    | { mode: "edit"; instance: CalendarEventInstance }
    | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  contactOptions?: { value: string; label: string }[];
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): Date {
  return new Date(value);
}

function CalendarEventEditor({ state, onClose, onSave, onDelete, contactOptions }: CalendarEventEditorProps) {
  const isEdit = state?.mode === "edit";
  const baseEvent: CalendarEvent | null = isEdit ? state.instance.event : null;

  const [title, setTitle] = useState("");
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(new Date());
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState<CalendarEventColor>("blue");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState("");
  const [recurs, setRecurs] = useState(false);
  const [frequency, setFrequency] = useState<CalendarRecurrenceFrequency>("weekly");
  const [endType, setEndType] = useState<"date" | "count">("count");
  const [endCount, setEndCount] = useState(5);
  const [endDate, setEndDate] = useState<Date>(addWeeks(new Date(), 8));

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const event = state.instance.event;
      setTitle(event.title);
      setStart(state.instance.occurrenceStart);
      setEnd(state.instance.occurrenceEnd);
      setAllDay(!!event.allDay);
      setColor(event.color);
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setContactId(event.contactId ?? "");
      setRecurs(!!event.recurrence);
      if (event.recurrence) {
        setFrequency(event.recurrence.frequency);
        if (event.recurrence.end.type === "date") {
          setEndType("date");
          setEndDate(event.recurrence.end.date);
        } else {
          setEndType("count");
          setEndCount(event.recurrence.end.count);
        }
      }
    } else {
      setTitle("");
      setStart(state.range.start);
      setEnd(state.range.end);
      setAllDay(!!state.allDay);
      setColor("blue");
      setLocation("");
      setDescription("");
      setContactId("");
      setRecurs(false);
      setFrequency("weekly");
      setEndType("count");
      setEndCount(5);
      setEndDate(addWeeks(state.range.start, 8));
    }
  }, [state]);

  if (!state) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const result: CalendarEvent = {
      id: baseEvent?.id ?? newId(),
      title: title.trim(),
      start,
      end: end > start ? end : addMinutesTo(start, SNAP_MINUTES),
      allDay,
      color,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      contactId: contactId || undefined,
      recurrence: recurs
        ? {
            frequency,
            end: endType === "count" ? { type: "count", count: Math.max(1, endCount) } : { type: "date", date: endDate },
          }
        : undefined,
    };
    onSave(result);
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Editing a recurring event updates the entire series."
                : "Fill in the details below to add this to the calendar."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            <Field>
              <Label htmlFor="calendar-event-title">Title</Label>
              <Input
                id="calendar-event-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Site visit — Acme Contracting"
                required
                autoFocus
              />
            </Field>

            {contactOptions && (
              <Field>
                <Label htmlFor="calendar-event-contact">Contact</Label>
                <Combobox
                  id="calendar-event-contact"
                  options={contactOptions}
                  value={contactId}
                  onValueChange={setContactId}
                  placeholder="None"
                />
              </Field>
            )}

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="calendar-event-allday" className="font-medium">
                All day
              </Label>
              <Switch id="calendar-event-allday" checked={allDay} onCheckedChange={setAllDay} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="calendar-event-start">
                  <Clock size={12} className="mr-1 inline" />
                  Start
                </Label>
                <Input
                  id="calendar-event-start"
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? toLocalInputValue(start).slice(0, 10) : toLocalInputValue(start)}
                  onChange={(e) => setStart(fromLocalInputValue(allDay ? `${e.target.value}T00:00` : e.target.value))}
                />
              </Field>
              <Field>
                <Label htmlFor="calendar-event-end">End</Label>
                <Input
                  id="calendar-event-end"
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? toLocalInputValue(end).slice(0, 10) : toLocalInputValue(end)}
                  onChange={(e) => setEnd(fromLocalInputValue(allDay ? `${e.target.value}T00:00` : e.target.value))}
                />
              </Field>
            </div>

            <Field>
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_EVENT_COLORS.map((c) => {
                  const colors = colorClasses(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={COLOR_LABELS[c]}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        color === c ? "scale-110 border-on-surface" : "border-transparent",
                      )}
                    >
                      <span className={cn("h-5 w-5 rounded-full", colors.dot)} />
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field>
              <Label htmlFor="calendar-event-location">
                <MapPin size={12} className="mr-1 inline" />
                Location
              </Label>
              <Input
                id="calendar-event-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
              />
            </Field>

            <Field>
              <Label htmlFor="calendar-event-description">Notes</Label>
              <Textarea
                id="calendar-event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="calendar-event-recurs" className="flex items-center gap-1.5 font-medium">
                <Repeat size={12} />
                Repeats
              </Label>
              <Switch id="calendar-event-recurs" checked={recurs} onCheckedChange={setRecurs} />
            </div>

            {recurs && (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-sunken p-3">
                <Field>
                  <Label htmlFor="calendar-event-frequency">Frequency</Label>
                  <NativeSelect
                    id="calendar-event-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as CalendarRecurrenceFrequency)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </NativeSelect>
                </Field>
                <Field>
                  <Label>Ends</Label>
                  <div className="flex items-center gap-2">
                    <NativeSelect
                      value={endType}
                      onChange={(e) => setEndType(e.target.value as "date" | "count")}
                      className="w-36"
                    >
                      <option value="count">After</option>
                      <option value="date">On date</option>
                    </NativeSelect>
                    {endType === "count" ? (
                      <Input
                        type="number"
                        min={1}
                        value={endCount}
                        onChange={(e) => setEndCount(Number(e.target.value) || 1)}
                        className="w-24"
                        aria-label="Occurrence count"
                      />
                    ) : (
                      <Input
                        type="date"
                        value={toLocalInputValue(endDate).slice(0, 10)}
                        onChange={(e) => setEndDate(fromLocalInputValue(`${e.target.value}T00:00`))}
                        className="w-40"
                        aria-label="End date"
                      />
                    )}
                    {endType === "count" && <span className="text-[13px] text-on-surface-muted">occurrences</span>}
                  </div>
                </Field>
              </div>
            )}
          </div>

          <DialogFooter className="justify-between">
            <div>
              {isEdit && baseEvent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-overdue hover:bg-overdue-bg"
                  onClick={() => onDelete(baseEvent.id)}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                {isEdit ? "Save changes" : "Create event"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
