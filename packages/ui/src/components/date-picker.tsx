"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { MiniCalendar } from "./calendar-mini";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-left text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-on-surface-muted",
            className,
          )}
        >
          {value ? value.toLocaleDateString() : placeholder}
          <CalendarIcon size={16} className="shrink-0 text-on-surface-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <MiniCalendar
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
