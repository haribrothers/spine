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
  isOccurrenceAlreadyModified,
  layoutOverlappingEvents,
} from "../lib/calendar-utils";
import { Button } from "./button";
import { Combobox } from "./combobox";
import {
  Dialog,
  DialogBody,
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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";
import { Switch } from "./switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export type { CalendarEvent, CalendarEventColor, CalendarEventInstance, CalendarRecurrenceRule, CalendarRecurrenceFrequency, CalendarRecurrenceEnd } from "../lib/calendar-utils";
export { CALENDAR_EVENT_COLORS, isOccurrenceAlreadyModified } from "../lib/calendar-utils";

export type CalendarView = "day" | "week" | "month" | "agenda";

/**
 * PRD S-01.14 — a completed drag-move or resize gesture on a recurring
 * occurrence, deferred to the consumer for a This event/All events choice
 * before Calendar commits anything (mirrors renderEventPopover's onEdit/
 * onDelete deferral for the click-edit path). `seriesEvent` is the whole
 * series shifted by the drag's offset (what "All events" should save);
 * `occurrenceStart`/`occurrenceEnd` are the dragged occurrence's own new
 * absolute time (what "This event" should save as an exception override);
 * `originalOccurrenceStart` is the exception's stable key.
 */
export interface RecurringMoveOrResizeRequest {
  seriesEvent: CalendarEvent;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  originalOccurrenceStart: Date;
}

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
  /** `extra` carries whatever `renderExtraFields` collected via its `setExtra` callback, opaque to Calendar itself — undefined when `renderExtraFields` isn't provided or contributed nothing. */
  onEventCreate?: (event: CalendarEvent, extra?: Record<string, unknown>) => void;
  /** `scope`/`occurrenceDate` are set when the edit was scoped to a single occurrence via `renderEventPopover`'s `onEdit` (PRD S-01.14) — undefined for a plain series-level save, same as before S-01.14. */
  onEventUpdate?: (event: CalendarEvent, extra?: Record<string, unknown>, scope?: "series" | "occurrence", occurrenceDate?: Date) => void;
  /** `scope`/`occurrenceDate` — see `onEventUpdate`'s own doc. */
  onEventDelete?: (eventId: string, scope?: "series" | "occurrence", occurrenceDate?: Date) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  /** When provided, the built-in event editor shows an optional "Contact" field (a searchable Combobox over these options) and round-trips the choice via CalendarEvent.contactId. Omit entirely for a calendar with no contact concept — the field simply doesn't render. */
  contactOptions?: { value: string; label: string }[];
  /**
   * Ids of events that should render as non-draggable, non-resizable
   * markers — clicking one calls `onReadOnlyEventClick` instead of opening
   * the built-in editor. For events from a source this calendar doesn't
   * own the lifecycle of (e.g. a read-only overlay of another record type
   * alongside the calendar's real events) — see `onReadOnlyEventClick`.
   */
  readOnlyEventIds?: Set<string>;
  /** Required when `readOnlyEventIds` is set — called with the clicked instance instead of opening the built-in editor. `target` is the clicked DOM element, e.g. for anchoring a consumer-rendered Popover the same way `renderEventPopover` anchors its own. */
  onReadOnlyEventClick?: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  /**
   * Escape hatch for consumer-specific fields the built-in editor form has
   * no concept of (e.g. meeting attendees/visibility) — same "generic slot
   * fed consumer-owned data" shape as `contactOptions`/`CalendarEvent.
   * contactId`, but for data that doesn't fit a single scalar field.
   * Rendered inline in the create/edit dialog, between the built-in fields
   * and the footer. Call `setExtra` with whatever shape your `onEventCreate`/
   * `onEventUpdate` handler expects to receive back as `extra` — Calendar
   * never inspects it. `event` is the event being edited (null in create
   * mode, since no id exists yet — an extra-fields UI that needs a
   * persisted id, like fetching existing attendees, can only do so once
   * `isEdit` is true).
   */
  renderExtraFields?: (ctx: { isEdit: boolean; event: CalendarEvent | null; setExtra: (extra: Record<string, unknown>) => void }) => React.ReactNode;
  /**
   * PRD S-01.13 — when provided, clicking a (non-read-only) event opens a
   * small anchored Popover instead of jumping straight into the built-in
   * edit dialog. Calendar owns the Popover's positioning/open-close chrome
   * (mirroring how it owns Dialog chrome for the editor) and delegates all
   * content to the consumer — same "generic slot, consumer owns the domain
   * content" shape as `renderExtraFields`. Call `onEdit(scope)`/
   * `onDelete(scope)` to close the popover and transition into the
   * built-in edit dialog (scoped, for a recurring event, to "series" or
   * "occurrence" — Calendar itself has no opinion on how that scope was
   * chosen, e.g. via a scope-choice dialog the consumer renders); call
   * `onClose()` to dismiss the popover with no further action. When this
   * prop is omitted, clicking an event opens the edit dialog directly, same
   * as before S-01.13.
   */
  renderEventPopover?: (ctx: {
    instance: CalendarEventInstance;
    onEdit: (scope?: "series" | "occurrence") => void;
    onDelete: (scope?: "series" | "occurrence") => void;
    onClose: () => void;
  }) => React.ReactNode;
  /**
   * PRD S-01.13's popover "Duplicate" action — set to a fresh object (e.g.
   * `{ event: draftEvent }`) to open the create dialog pre-filled from
   * `event`. Calendar reacts via a change in object identity, not a
   * boolean, so duplicating the same event twice in a row (or duplicating
   * while the dialog is already open) still re-triggers reliably. Omit
   * entirely if the consumer has no duplicate feature.
   */
  duplicateRequest?: { event: CalendarEvent } | null;
  /**
   * PRD S-01.14 — called instead of committing directly when the user
   * finishes dragging or resizing an occurrence that belongs to a
   * recurring series (Day/Week views only — Month has no drag-move).
   * Calendar does not render any dialog itself here (unlike
   * `renderEventPopover`, there's no anchored popover step for a drag
   * gesture to render into) — the consumer is expected to show its own
   * This event/All events confirmation (e.g. the same one already used
   * for the click-edit path) and then call `onConfirm(scope)` to commit
   * via `onEventUpdate`, or `onCancel()` to snap the event back to its
   * original slot with no change. When this prop is omitted, a drag/resize
   * on a recurring occurrence silently moves the whole series, matching
   * behavior before S-01.14.
   */
  onRecurringMoveOrResize?: (request: RecurringMoveOrResizeRequest, onConfirm: (scope: "series" | "occurrence") => void, onCancel: () => void) => void;
  /**
   * Double-clicking a (non-read-only) event bypasses the quick-view popover
   * (if any) and goes straight to editing — same destination as clicking
   * Edit inside the popover, just one step shorter. Calendar hands the
   * consumer the exact same `onEdit`/`onDelete` closures `renderEventPopover`
   * receives (transition into the built-in edit dialog, scoped as
   * requested), so a consumer already handling the popover's Edit button —
   * including any "already individually modified, skip the scope prompt"
   * logic — reuses that same code path unchanged. Omit entirely to leave
   * double-click a no-op beyond whatever single-click already does.
   */
  onEventDoubleClick?: (ctx: {
    instance: CalendarEventInstance;
    onEdit: (scope?: "series" | "occurrence") => void;
    onDelete: (scope?: "series" | "occurrence") => void;
  }) => void;
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
  readOnlyEventIds,
  onReadOnlyEventClick,
  renderExtraFields,
  renderEventPopover,
  duplicateRequest,
  onRecurringMoveOrResize,
  onEventDoubleClick,
  className,
}: CalendarProps) {
  const [editorState, setEditorState] = useState<
    | { mode: "create"; range: DraftRange; allDay?: boolean; prefillFrom?: CalendarEvent }
    | { mode: "edit"; instance: CalendarEventInstance; scope?: "series" | "occurrence" }
    | null
  >(null);
  const [popoverInstance, setPopoverInstance] = useState<CalendarEventInstance | null>(null);
  const popoverAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!duplicateRequest) return;
    const { event } = duplicateRequest;
    setEditorState({
      mode: "create",
      range: { start: event.start, end: event.end },
      allDay: event.allDay,
      prefillFrom: event,
    });
  }, [duplicateRequest]);

  const goToday = () => onDateChange(new Date());
  const goPrev = () => onDateChange(stepDate(date, view, -1));
  const goNext = () => onDateChange(stepDate(date, view, 1));

  const handleSlotCreate = (range: DraftRange, allDay?: boolean) => {
    setEditorState({ mode: "create", range, allDay });
  };

  const handleEventClick = (instance: CalendarEventInstance, target?: HTMLElement) => {
    if (readOnlyEventIds?.has(instance.event.id)) {
      onReadOnlyEventClick?.(instance, target);
      return;
    }
    if (renderEventPopover) {
      popoverAnchorRef.current = target ?? null;
      setPopoverInstance(instance);
      return;
    }
    setEditorState({ mode: "edit", instance });
  };

  const handleEventDoubleClick = (instance: CalendarEventInstance) => {
    if (readOnlyEventIds?.has(instance.event.id)) return;
    if (!onEventDoubleClick) {
      // No consumer opt-in — go straight to the built-in edit dialog,
      // same destination single-click reaches without a popover configured.
      setEditorState({ mode: "edit", instance });
      return;
    }
    // Same onEdit/onDelete closures the popover itself receives (see
    // renderEventPopover's own call below) — a consumer already handling
    // Edit from the popover, including any already-modified/scope-choice
    // logic, reuses that exact same code path here.
    setPopoverInstance(null);
    onEventDoubleClick({
      instance,
      onEdit: (scope) => {
        setEditorState({ mode: "edit", instance, scope });
      },
      onDelete: (scope) => {
        const occurrenceDate = scope === "occurrence" ? instance.originalOccurrenceStart : undefined;
        onEventDelete?.(instance.event.id, scope, occurrenceDate);
      },
    });
  };

  const handleSave = (result: CalendarEvent, extra?: Record<string, unknown>) => {
    if (editorState?.mode === "edit") {
      const scope = editorState.scope;
      // originalOccurrenceStart, not occurrenceStart — the exception key
      // must stay the series-computed date even if this save (or a prior
      // one) changed the occurrence's displayed time, or a second edit to
      // the same occurrence would target a different key than the first.
      onEventUpdate?.(result, extra, scope, scope === "occurrence" ? editorState.instance.originalOccurrenceStart : undefined);
    } else {
      onEventCreate?.(result, extra);
    }
    setEditorState(null);
  };

  const handleDelete = (eventId: string) => {
    const scope = editorState?.mode === "edit" ? editorState.scope : undefined;
    const occurrenceDate = scope === "occurrence" && editorState?.mode === "edit" ? editorState.instance.originalOccurrenceStart : undefined;
    onEventDelete?.(eventId, scope, occurrenceDate);
    setEditorState(null);
  };

  const handleEventUpdate = (event: CalendarEvent, scope?: "series" | "occurrence", occurrenceDate?: Date) => {
    if (readOnlyEventIds?.has(event.id)) return;
    onEventUpdate?.(event, undefined, scope, occurrenceDate);
  };

  const handleRecurringMoveOrResize = (request: RecurringMoveOrResizeRequest) => {
    if (readOnlyEventIds?.has(request.seriesEvent.id)) return;
    if (!onRecurringMoveOrResize) {
      // No consumer opt-in — preserve pre-S-01.14 behavior (whole series moves).
      onEventUpdate?.(request.seriesEvent);
      return;
    }
    onRecurringMoveOrResize(
      request,
      (scope) => {
        if (scope === "occurrence") {
          onEventUpdate?.(
            { ...request.seriesEvent, start: request.occurrenceStart, end: request.occurrenceEnd },
            undefined,
            "occurrence",
            request.originalOccurrenceStart,
          );
        } else {
          onEventUpdate?.(request.seriesEvent);
        }
      },
      () => {
        // Cancel — nothing to revert here; TimeGrid already discarded its
        // own drag state on pointerup regardless of what handleUp did, so
        // the event simply re-renders at its last-committed position.
      },
    );
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
            onEventDoubleClick={handleEventDoubleClick}
            onEventUpdate={handleEventUpdate}
            onRecurringMoveOrResize={handleRecurringMoveOrResize}
            readOnlyEventIds={readOnlyEventIds}
          />
        )}
        {view === "week" && (
          <CalendarWeekView
            date={date}
            events={events}
            onSlotCreate={handleSlotCreate}
            onEventClick={handleEventClick}
            onEventDoubleClick={handleEventDoubleClick}
            onEventUpdate={handleEventUpdate}
            onRecurringMoveOrResize={handleRecurringMoveOrResize}
            readOnlyEventIds={readOnlyEventIds}
          />
        )}
        {view === "month" && (
          <CalendarMonthView
            date={date}
            events={events}
            onDayCreate={(day) => handleSlotCreate({ start: day, end: addDays(day, 1) }, true)}
            onEventClick={handleEventClick}
            onEventDoubleClick={handleEventDoubleClick}
            onDateChange={onDateChange}
            onViewChange={onViewChange}
          />
        )}
        {view === "agenda" && (
          <CalendarAgendaView date={date} events={events} onEventClick={handleEventClick} onEventDoubleClick={handleEventDoubleClick} />
        )}
      </div>

      <CalendarEventEditor
        state={editorState}
        events={events}
        onClose={() => setEditorState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onScopeChange={(scope) => {
          setEditorState((prev) => (prev?.mode === "edit" ? { ...prev, scope } : prev));
        }}
        contactOptions={contactOptions}
        renderExtraFields={renderExtraFields}
      />

      {renderEventPopover && (
        <Popover
          open={!!popoverInstance}
          onOpenChange={(open) => {
            if (!open) setPopoverInstance(null);
          }}
        >
          <PopoverAnchor virtualRef={popoverAnchorRef} />
          <PopoverContent
            align="start"
            side="right"
            className="w-80 p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {popoverInstance &&
              renderEventPopover({
                instance: popoverInstance,
                onEdit: (scope) => {
                  const instance = popoverInstance;
                  setPopoverInstance(null);
                  setEditorState({ mode: "edit", instance, scope });
                },
                onDelete: (scope) => {
                  const instance = popoverInstance;
                  setPopoverInstance(null);
                  const occurrenceDate = scope === "occurrence" ? instance.originalOccurrenceStart : undefined;
                  onEventDelete?.(instance.event.id, scope, occurrenceDate);
                },
                onClose: () => setPopoverInstance(null),
              })}
          </PopoverContent>
        </Popover>
      )}
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
  // The clicked occurrence's date/time when the gesture began — used to
  // detect "no actual movement" (a plain click) and to compute the offset
  // to apply to the series' real originalEvent.start/end, since currentStart
  // is seeded from the occurrence's date, not the series anchor. Only set
  // for "move"/"resize-*" (kind "create" has no occurrence).
  dragStartOccurrenceStart?: Date;
  dragStartOccurrenceEnd?: Date;
  // PRD S-01.14 — whether the dragged/resized instance belongs to a
  // recurring series, and (when it does) the series-computed date that
  // identifies this occurrence for an exception, independent of any
  // existing time override (see CalendarEventInstance.originalOccurrenceStart's
  // own doc comment for why this must stay fixed across edits).
  isRecurring?: boolean;
  originalOccurrenceStart?: Date;
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
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  onEventDoubleClick?: (instance: CalendarEventInstance) => void;
  onEventUpdate: (event: CalendarEvent, scope?: "series" | "occurrence", occurrenceDate?: Date) => void;
  /** PRD S-01.14 — when set, a move/resize on a recurring occurrence defers here instead of calling onEventUpdate directly. Omit to fall back to today's whole-series-move behavior (matches renderEventPopover's own opt-in shape). */
  onRecurringMoveOrResize?: (request: RecurringMoveOrResizeRequest) => void;
  readOnlyEventIds?: Set<string>;
}

/**
 * Shared hour-grid rendering + pointer-driven drag-create/move/resize used
 * by both Day and Week views (Week is just N adjacent day columns sharing
 * one grid). Pointer events (not HTML5 DnD) drive all three interactions
 * so touch works and live feedback (the draft block following the pointer)
 * is simple to render — see calendar.tsx's module doc for why.
 */
function TimeGrid({ days, events, onSlotCreate, onEventClick, onEventDoubleClick, onEventUpdate, onRecurringMoveOrResize, readOnlyEventIds }: TimeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<TimeGridDragState | null>(null);
  const dragRef = useRef<TimeGridDragState | null>(null);
  dragRef.current = drag;
  // A pointerdown→move→up sequence that actually moved/resized an event
  // still fires a native `click` on pointerup (onMoveStart fires on
  // pointerdown, before the click) — without this guard, a real drag would
  // ALSO open the click-to-edit popover on top of (and blocking) any
  // scope-choice confirmation the drag itself triggered. Set the instant a
  // real move/resize is detected in handleUp, consumed and cleared by the
  // very next click.
  const suppressNextClickRef = useRef(false);

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
      dragStartOccurrenceStart: instance.occurrenceStart,
      dragStartOccurrenceEnd: instance.occurrenceEnd,
      isRecurring: instance.isRecurring,
      originalOccurrenceStart: instance.originalOccurrenceStart,
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
      dragStartOccurrenceStart: instance.occurrenceStart,
      dragStartOccurrenceEnd: instance.occurrenceEnd,
      isRecurring: instance.isRecurring,
      originalOccurrenceStart: instance.originalOccurrenceStart,
      pointerId: e.pointerId,
    });
  };

  // Shared by the pointer-drag commit (handleUp below) and keyboard resize
  // (onKeyboardResize passed to TimeGridEvent) — both end up with the same
  // "occurrence's original start/end vs. its new start/end" shape and must
  // resolve recurrence exceptions identically, so this is the single place
  // that decides series-move vs. this-event vs. defer-to-scope-choice.
  const commitMoveOrResize = (
    originalEvent: CalendarEvent,
    dragStartOccurrenceStart: Date,
    dragStartOccurrenceEnd: Date,
    newStart: Date,
    newEnd: Date,
    isRecurring: boolean | undefined,
    originalOccurrenceStart: Date | undefined,
  ) => {
    const startOffset = newStart.getTime() - dragStartOccurrenceStart.getTime();
    const endOffset = newEnd.getTime() - dragStartOccurrenceEnd.getTime();
    if (startOffset === 0 && endOffset === 0) return;
    suppressNextClickRef.current = true;
    const seriesUpdate: CalendarEvent = {
      ...originalEvent,
      start: new Date(originalEvent.start.getTime() + startOffset),
      end: new Date(originalEvent.end.getTime() + endOffset),
    };
    if (isRecurring && originalOccurrenceStart && !isOccurrenceAlreadyModified(originalEvent, originalOccurrenceStart, true)) {
      onRecurringMoveOrResize?.({
        seriesEvent: seriesUpdate,
        occurrenceStart: newStart,
        occurrenceEnd: newEnd,
        originalOccurrenceStart,
      });
    } else if (isRecurring && originalOccurrenceStart) {
      onEventUpdate({ ...seriesUpdate, start: newStart, end: newEnd }, "occurrence", originalOccurrenceStart);
    } else {
      onEventUpdate(seriesUpdate);
    }
  };

  const handleKeyboardResize = (instance: CalendarEventInstance, edge: "start" | "end", direction: 1 | -1) => {
    const deltaMs = direction * SNAP_MINUTES * 60000;
    let newStart = instance.occurrenceStart;
    let newEnd = instance.occurrenceEnd;
    if (edge === "start") {
      const candidate = new Date(instance.occurrenceStart.getTime() + deltaMs);
      newStart = candidate < instance.occurrenceEnd ? candidate : new Date(instance.occurrenceEnd.getTime() - SNAP_MINUTES * 60000);
    } else {
      const candidate = new Date(instance.occurrenceEnd.getTime() + deltaMs);
      newEnd = candidate > instance.occurrenceStart ? candidate : new Date(instance.occurrenceStart.getTime() + SNAP_MINUTES * 60000);
    }
    commitMoveOrResize(
      instance.event,
      instance.occurrenceStart,
      instance.occurrenceEnd,
      newStart,
      newEnd,
      instance.isRecurring,
      instance.originalOccurrenceStart,
    );
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
        if (prev.kind === "move" && prev.originalEvent && prev.dragStartOccurrenceStart && prev.dragStartOccurrenceEnd) {
          // The occurrence's own current duration, not the series'
          // originalEvent.start/end — a previously-resized single
          // occurrence (a "this event" resize) must keep its own length
          // while being dragged to a new time, not snap back to the
          // series' original duration.
          const duration = prev.dragStartOccurrenceEnd.getTime() - prev.dragStartOccurrenceStart.getTime();
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
      } else if (finished.originalEvent && finished.dragStartOccurrenceStart && finished.dragStartOccurrenceEnd) {
        // A plain click (no actual pointer movement) still runs the full
        // move gesture — onMoveStart fires on pointerdown before onClick.
        // currentStart/End were seeded from the *occurrence's* date
        // (instance.occurrenceStart/End), not the series' real
        // originalEvent.start/end, so committing an update here on every
        // click would silently move the whole recurring series to whatever
        // occurrence was clicked. commitMoveOrResize itself no-ops when
        // nothing actually moved.
        commitMoveOrResize(
          finished.originalEvent,
          finished.dragStartOccurrenceStart,
          finished.dragStartOccurrenceEnd,
          finished.currentStart,
          finished.currentEnd,
          finished.isRecurring,
          finished.originalOccurrenceStart,
        );
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
  }, [drag?.kind, drag?.dayIndex, gridHeight, days, onEventUpdate, onRecurringMoveOrResize, onSlotCreate]);

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

  return (
    // select-none only while a drag is active — a fast pointer move during
    // create/move/resize was catching the hour labels/event text in a
    // native text selection; the grid has no text worth selecting anyway
    // once a gesture starts, and this keeps titles copy-able at rest.
    <div className={cn("flex flex-col", drag && "select-none")}>
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
                        onClick={(e) => onEventClick(instance, e.currentTarget)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onEventDoubleClick?.(instance);
                        }}
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
                    isReadOnly={readOnlyEventIds?.has(slot.instance.event.id) ?? false}
                    onEventClick={(instance, target) => {
                      if (suppressNextClickRef.current) {
                        suppressNextClickRef.current = false;
                        return;
                      }
                      onEventClick(instance, target);
                    }}
                    onEventDoubleClick={onEventDoubleClick}
                    onMoveStart={(e) => beginMove(slot.instance, dayIndex, e)}
                    onResizeStart={(edge, e) => beginResize(slot.instance, dayIndex, edge, e)}
                    onKeyboardResize={(edge, direction) => handleKeyboardResize(slot.instance, edge, direction)}
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
  isReadOnly?: boolean;
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  onEventDoubleClick?: (instance: CalendarEventInstance) => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (edge: "start" | "end", e: React.PointerEvent) => void;
  /** Keyboard equivalent of dragging a resize handle — the pointer-only handles below have no other way to reach via keyboard. */
  onKeyboardResize: (edge: "start" | "end", direction: 1 | -1) => void;
}

function TimeGridEvent({ slot, gridHeight, isDragging, isReadOnly = false, onEventClick, onEventDoubleClick, onMoveStart, onResizeStart, onKeyboardResize }: TimeGridEventProps) {
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
      aria-label={
        isReadOnly
          ? `${instance.event.title}, ${format(instance.occurrenceStart, "h:mm a")} to ${format(instance.occurrenceEnd, "h:mm a")}`
          : `${instance.event.title}, ${format(instance.occurrenceStart, "h:mm a")} to ${format(instance.occurrenceEnd, "h:mm a")}. Press Enter to open, or Shift plus Arrow Up or Down to change the start time, Shift plus Alt plus Arrow Up or Down to change the end time.`
      }
      className={cn(
        "group absolute select-none overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11.5px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        colors.bg,
        colors.fg,
        colors.border,
        isDragging && "opacity-60",
      )}
      style={{ top, height, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, cursor: "pointer" }}
      onPointerDown={isReadOnly ? (e) => e.stopPropagation() : onMoveStart}
      onClick={(e) => onEventClick(instance, e.currentTarget)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isReadOnly) onEventDoubleClick?.(instance);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEventClick(instance, e.currentTarget);
          return;
        }
        // Keyboard equivalent of dragging the pointer-only resize handles:
        // Shift+Arrow adjusts the start edge, Shift+Alt+Arrow the end edge —
        // mirrors the same snap increment as a pointer resize.
        if (!isReadOnly && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const direction = e.key === "ArrowUp" ? -1 : 1;
          onKeyboardResize(e.altKey ? "end" : "start", direction);
        }
      }}
    >
      <div className="flex items-center gap-1 font-medium">
        {instance.event.recurrence && <Repeat size={10} className="shrink-0" />}
        <span className="truncate">{instance.event.title}</span>
      </div>
      {height > 32 && <span className="block truncate opacity-80">{format(instance.occurrenceStart, "h:mm a")}</span>}

      {!isReadOnly && (
        <>
          <div
            className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
            onPointerDown={(e) => onResizeStart("start", e)}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
            onPointerDown={(e) => onResizeStart("end", e)}
          />
        </>
      )}
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
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  onEventDoubleClick?: (instance: CalendarEventInstance) => void;
  onEventUpdate: (event: CalendarEvent, scope?: "series" | "occurrence", occurrenceDate?: Date) => void;
  onRecurringMoveOrResize?: (request: RecurringMoveOrResizeRequest) => void;
  readOnlyEventIds?: Set<string>;
}

function CalendarDayView({ date, events, onSlotCreate, onEventClick, onEventDoubleClick, onEventUpdate, onRecurringMoveOrResize, readOnlyEventIds }: DayLikeViewProps) {
  return (
    <TimeGrid
      days={[date]}
      events={events}
      onSlotCreate={onSlotCreate}
      onEventClick={onEventClick}
      onEventDoubleClick={onEventDoubleClick}
      onEventUpdate={onEventUpdate}
      onRecurringMoveOrResize={onRecurringMoveOrResize}
      readOnlyEventIds={readOnlyEventIds}
    />
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function CalendarWeekView({ date, events, onSlotCreate, onEventClick, onEventDoubleClick, onEventUpdate, onRecurringMoveOrResize, readOnlyEventIds }: DayLikeViewProps) {
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
      <TimeGrid
        days={days}
        events={events}
        onSlotCreate={onSlotCreate}
        onEventClick={onEventClick}
        onEventDoubleClick={onEventDoubleClick}
        onEventUpdate={onEventUpdate}
        onRecurringMoveOrResize={onRecurringMoveOrResize}
        readOnlyEventIds={readOnlyEventIds}
      />
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
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  onEventDoubleClick?: (instance: CalendarEventInstance) => void;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

function CalendarMonthView({ date, events, onDayCreate, onEventClick, onEventDoubleClick, onDateChange, onViewChange }: MonthViewProps) {
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
                            onEventClick(instance, e.currentTarget);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onEventDoubleClick?.(instance);
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
  onEventClick: (instance: CalendarEventInstance, target?: HTMLElement) => void;
  onEventDoubleClick?: (instance: CalendarEventInstance) => void;
}

const AGENDA_WINDOW_DAYS = 60;

function CalendarAgendaView({ date, events, onEventClick, onEventDoubleClick }: AgendaViewProps) {
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
                    onClick={(e) => onEventClick(instance, e.currentTarget)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onEventDoubleClick?.(instance);
                    }}
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
    | { mode: "create"; range: DraftRange; allDay?: boolean; prefillFrom?: CalendarEvent }
    | { mode: "edit"; instance: CalendarEventInstance; scope?: "series" | "occurrence" }
    | null;
  onClose: () => void;
  onSave: (event: CalendarEvent, extra?: Record<string, unknown>) => void;
  onDelete: (eventId: string) => void;
  /** PRD S-01.14 — lets the "Edit series instead" link switch an in-progress occurrence-scoped edit to series scope without closing the dialog; the form re-seeds from the series' own values via the existing state-keyed useEffect. Only meaningful (and only rendered) when editing a recurring event. */
  onScopeChange?: (scope: "series" | "occurrence") => void;
  /**
   * The raw, unexpanded event list — needed so a series-scope seed can look
   * up the TRUE series row by id rather than `state.instance.event`, which
   * for an already-modified occurrence is a shallow clone with
   * title/location/description overridden for THAT occurrence's display
   * (see expandRecurringEvent's own comment) — using it directly for a
   * series-scope seed would silently carry the occurrence's override into
   * the series on save.
   */
  events?: CalendarEvent[];
  contactOptions?: { value: string; label: string }[];
  renderExtraFields?: (ctx: { isEdit: boolean; event: CalendarEvent | null; setExtra: (extra: Record<string, unknown>) => void }) => React.ReactNode;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): Date {
  return new Date(value);
}

function CalendarEventEditor({ state, events, onClose, onSave, onDelete, onScopeChange, contactOptions, renderExtraFields }: CalendarEventEditorProps) {
  const isEdit = state?.mode === "edit";
  const baseEvent: CalendarEvent | null = isEdit ? state.instance.event : null;
  const extraRef = useRef<Record<string, unknown> | undefined>(undefined);

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
    // Reset per-open — a stale `extra` from a previously-closed dialog must
    // never leak into a different create/edit session.
    extraRef.current = undefined;
    if (state.mode === "edit") {
      const isOccurrenceScoped = state.scope === "occurrence";
      // For series scope, seed from the TRUE series row (looked up in the
      // raw `events` list by id), not `state.instance.event` — the latter
      // is a shallow clone with title/location/description overridden for
      // an already-modified occurrence's own display (see
      // expandRecurringEvent's own comment), and using it here would
      // silently carry that occurrence's override into the series on save
      // (the "Edit series instead" transition is the path that surfaces
      // this). Falls back to instance.event if the series row can't be
      // found (defensive only — should always be present).
      const event = isOccurrenceScoped
        ? state.instance.event
        : (events?.find((e) => e.id === state.instance.event.id) ?? state.instance.event);
      // Editing the whole SERIES rewrites all of it (see this dialog's
      // scope-conditional description below, and handleSave, which has no
      // per-occurrence branch of its own) — so the form must seed start/end
      // from the series' own anchor (event.start/end), never from the
      // specific occurrence that was clicked. Using occurrenceStart/End
      // here was a real bug: clicking any occurrence other than the first
      // and saving (even with no changes) silently moved the entire
      // series' start date to whichever occurrence happened to be clicked.
      // Editing a single OCCURRENCE (state.scope === "occurrence") is the
      // opposite: it must seed from that occurrence's own
      // occurrenceStart/occurrenceEnd (which already reflects any existing
      // "modified" exception override, per expandRecurringEvent), since
      // that's the value being saved as a new/updated exception, not a
      // series mutation.
      setTitle(event.title);
      setStart(isOccurrenceScoped ? state.instance.occurrenceStart : event.start);
      setEnd(isOccurrenceScoped ? state.instance.occurrenceEnd : event.end);
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
      const prefill = state.prefillFrom;
      setTitle(prefill?.title ?? "");
      setStart(state.range.start);
      setEnd(state.range.end);
      setAllDay(!!state.allDay);
      setColor(prefill?.color ?? "blue");
      setLocation(prefill?.location ?? "");
      setDescription(prefill?.description ?? "");
      setContactId(prefill?.contactId ?? "");
      setRecurs(!!prefill?.recurrence);
      if (prefill?.recurrence) {
        setFrequency(prefill.recurrence.frequency);
        if (prefill.recurrence.end.type === "date") {
          setEndType("date");
          setEndDate(prefill.recurrence.end.date);
        } else {
          setEndType("count");
          setEndCount(prefill.recurrence.end.count);
        }
      } else {
        setFrequency("weekly");
        setEndType("count");
        setEndCount(5);
        setEndDate(addWeeks(state.range.start, 8));
      }
    }
  }, [state]);

  if (!state) return null;

  // PRD S-01.14 — editing a single occurrence only ever writes
  // start/end/location/description onto the exception row (see
  // MeetingsService.updateOccurrenceException) — title/contact/category/
  // all-day/recurrence all stay series-level. Title/Contact/Category/All-day
  // are shown read-only rather than hidden (so the occurrence's real values
  // are still visible at a glance); Repeats/Frequency are hidden outright
  // since recurrence itself can never be occurrence-scoped.
  const isOccurrenceScoped = state.mode === "edit" && state.scope === "occurrence";

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
    onSave(result, extraRef.current);
  };

  const detailsFields = (
    <>
      <Field>
        <Label htmlFor="calendar-event-title">Title</Label>
        <Input
          id="calendar-event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Site visit — Acme Contracting"
          required
          autoFocus={!isOccurrenceScoped}
          readOnly={isOccurrenceScoped}
          aria-readonly={isOccurrenceScoped}
          className={isOccurrenceScoped ? "cursor-not-allowed bg-surface-sunken text-on-surface-muted" : undefined}
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
            disabled={isOccurrenceScoped}
          />
        </Field>
      )}

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <Label htmlFor="calendar-event-allday" className="font-medium">
          All day
        </Label>
        <Switch id="calendar-event-allday" checked={allDay} onCheckedChange={setAllDay} disabled={isOccurrenceScoped} />
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
                disabled={isOccurrenceScoped}
                onClick={() => setColor(c)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  color === c ? "scale-110 border-on-surface" : "border-transparent",
                  isOccurrenceScoped && "cursor-not-allowed opacity-50",
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

      {!isOccurrenceScoped && (
        <>
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
        </>
      )}
    </>
  );

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? state.mode === "edit" && state.scope === "occurrence"
                  ? "Editing just this occurrence — the rest of the series is unaffected."
                  : "Editing updates the entire series."
                : "Fill in the details below to add this to the calendar."}
            </DialogDescription>
            {isEdit && state.mode === "edit" && state.scope === "occurrence" && state.instance.isRecurring && (
              <button
                type="button"
                className="w-fit text-left text-[12.5px] font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => onScopeChange?.("series")}
              >
                Edit the series instead
              </button>
            )}
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {renderExtraFields ? (
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="people">People</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="flex flex-col gap-4">
                  {detailsFields}
                </TabsContent>
                <TabsContent value="people" className="flex flex-col gap-4">
                  {isEdit && state.mode === "edit" && state.scope === "occurrence" ? (
                    <p className="rounded-md border border-border bg-surface-sunken p-3 text-[13px] text-on-surface-muted">
                      Visibility and invitees apply to the whole series — edit the series to change them.
                    </p>
                  ) : (
                    renderExtraFields({
                      isEdit,
                      event: baseEvent,
                      setExtra: (extra) => {
                        extraRef.current = extra;
                      },
                    })
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              detailsFields
            )}
          </DialogBody>

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
