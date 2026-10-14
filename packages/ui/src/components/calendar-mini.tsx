"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The key `marks` uses for a day: its local date as YYYY-MM-DD. */
export function miniCalendarDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDayTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export interface MiniCalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  className?: string;
  /** Extra content rendered at the right end of the month-nav header row, after the "next month" button — e.g. a panel-collapse toggle when this MiniCalendar anchors a larger sidebar. Omit for the plain month-picker usage (DatePicker, Calendar's own toolbar popover). */
  headerAction?: React.ReactNode;
  /** US-MTG-13 — the month shown (any day in it). With `onMonthChange`, the month is controlled, e.g. to follow a larger calendar. */
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** US-MTG-13 — counts by day (keys from `miniCalendarDayKey`); a day with a count above 0 gets one dot, its count on hover and in its accessible name. */
  marks?: Map<string, number>;
  /** How a count reads, e.g. `(n) => \`${n} meetings\``. */
  markLabel?: (count: number) => string;
  /** US-MTG-13 — days shaded as the range on screen elsewhere (e.g. the week a calendar shows). */
  highlight?: { start: Date; end: Date };
}

const defaultMarkLabel = (count: number) => `${count} ${count === 1 ? "event" : "events"}`;

/**
 * A minimal month-grid calendar, no external date library — DatePicker
 * hosts this inside a Popover per docs/DESIGN.md rather than relying on
 * inconsistent native <input type=date> chrome. Also reused as the mini
 * month-picker inside the full scheduling Calendar's toolbar (calendar.tsx)
 * — kept in its own file so Calendar can import it without a self-import.
 * The Meetings sidebar adds marks for busy days, a shaded range and a
 * controlled month (US-MTG-13, D-212).
 */
export function MiniCalendar({ selected, onSelect, className, headerAction, month, onMonthChange, marks, markLabel = defaultMarkLabel, highlight }: MiniCalendarProps) {
  const [ownViewDate, setOwnViewDate] = useState(selected ?? new Date());
  const controlled = month !== undefined && onMonthChange !== undefined;
  const viewDate = controlled ? month : ownViewDate;
  const setViewDate = (next: Date) => (controlled ? onMonthChange(next) : setOwnViewDate(next));
  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = daysInMonth(year, monthIndex);
  const today = new Date();
  const range = highlight ? { start: startOfDayTime(highlight.start), end: startOfDayTime(highlight.end) } : null;

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1)),
  ];
  // Trailing nulls so the last week is a full 7-cell row too — role="row"
  // needs a consistent row width, and it keeps the CSS grid rectangular.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const grid = (
    <div className={cn("w-64", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewDate(new Date(year, monthIndex - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, monthIndex + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-[13px] font-semibold text-on-surface" aria-live="polite">
            {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
        </div>
        {headerAction}
      </div>
      <div role="grid" aria-label={viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })} className="flex flex-col gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} role="columnheader" className="flex h-7 items-center justify-center text-[11px] font-medium text-on-surface-muted">
              {label}
            </div>
          ))}
        </div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIndex) => {
          const week = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
          // The shaded range is one band across the week's days, behind them.
          const inBand = week.map((d) => Boolean(d && range && d.getTime() >= range.start && d.getTime() <= range.end));
          const bandFrom = inBand.indexOf(true);
          const bandTo = inBand.lastIndexOf(true);
          return (
          <div key={weekIndex} role="row" className="grid grid-cols-7 gap-1">
            {bandFrom >= 0 && (
              <div aria-hidden className="rounded-md bg-info-bg" data-range-band style={{ gridRow: 1, gridColumn: `${bandFrom + 1} / ${bandTo + 2}` }} />
            )}
            {week.map((date, index) => {
              if (!date) return <div key={`empty-${weekIndex}-${index}`} role="presentation" style={{ gridRow: 1, gridColumn: index + 1 }} />;
              const isSelected = Boolean(selected && isSameDay(date, selected));
              const isToday = isSameDay(date, today);
              const count = marks?.get(miniCalendarDayKey(date)) ?? 0;
              const inRange = inBand[index] ?? false;
              const name = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              const button = (
                <button
                  key={date.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={count > 0 ? `${name}, ${markLabel(count)}` : name}
                  data-marked={count > 0 || undefined}
                  data-in-range={inRange || undefined}
                  onClick={() => onSelect(date)}
                  style={{ gridRow: 1, gridColumn: index + 1 }}
                  className={cn(
                    "relative flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isToday && !isSelected && "font-semibold text-primary",
                    isSelected && "bg-primary text-on-primary hover:bg-primary-hover",
                  )}
                >
                  {date.getDate()}
                  {count > 0 && (
                    <span aria-hidden className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", isSelected ? "bg-on-primary" : "bg-primary")} />
                  )}
                </button>
              );
              return count > 0 ? (
                <Tooltip key={date.toISOString()}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>{`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ${markLabel(count)}`}</TooltipContent>
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );

  return marks ? <TooltipProvider delayDuration={300}>{grid}</TooltipProvider> : grid;
}
