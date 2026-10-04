"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export interface MiniCalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  className?: string;
  /** Extra content rendered at the right end of the month-nav header row, after the "next month" button — e.g. a panel-collapse toggle when this MiniCalendar anchors a larger sidebar. Omit for the plain month-picker usage (DatePicker, Calendar's own toolbar popover). */
  headerAction?: React.ReactNode;
}

/**
 * A minimal month-grid calendar, no external date library — DatePicker
 * hosts this inside a Popover per docs/DESIGN.md rather than relying on
 * inconsistent native <input type=date> chrome. Also reused as the mini
 * month-picker inside the full scheduling Calendar's toolbar (calendar.tsx)
 * — kept in its own file so Calendar can import it without a self-import.
 */
export function MiniCalendar({ selected, onSelect, className, headerAction }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Trailing nulls so the last week is a full 7-cell row too — role="row"
  // needs a consistent row width, and it keeps the CSS grid rectangular.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <div className={cn("w-64", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-[13px] font-semibold text-on-surface">
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
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIndex) => (
          <div key={weekIndex} role="row" className="grid grid-cols-7 gap-1">
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, index) => {
              if (!date) return <div key={`empty-${weekIndex}-${index}`} role="presentation" />;
              const isSelected = Boolean(selected && isSameDay(date, selected));
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  onClick={() => onSelect(date)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isToday && !isSelected && "font-semibold text-primary",
                    isSelected && "bg-primary text-on-primary hover:bg-primary-hover",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
