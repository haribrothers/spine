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
}

/**
 * A minimal month-grid calendar, no external date library — DatePicker
 * hosts this inside a Popover per docs/DESIGN.md rather than relying on
 * inconsistent native <input type=date> chrome. Also reused as the mini
 * month-picker inside the full scheduling Calendar's toolbar (calendar.tsx)
 * — kept in its own file so Calendar can import it without a self-import.
 */
export function MiniCalendar({ selected, onSelect, className }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div className={cn("w-64", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold text-on-surface">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="flex h-7 items-center justify-center text-[11px] font-medium text-on-surface-muted">
            {label}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-[13px] text-on-surface transition-colors hover:bg-surface-sunken",
                selected && isSameDay(date, selected) && "bg-primary text-white hover:bg-primary-hover",
              )}
            >
              {date.getDate()}
            </button>
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}
