"use client";

import { useId } from "react";
import { Input } from "@spine/ui";
import { HSN_SAC_MESSAGE, isValidHsnSac } from "@spine/shared";

/** US-TAX-14 — a document line's HSN/SAC code (4, 6 or 8 digits), copied from its item. */
export function HsnSacField({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const id = useId();
  const error = value && !isValidHsnSac(value) ? HSN_SAC_MESSAGE : null;
  if (compact) {
    // US-QUO-34: one cell in the quote builder's line grid, its label inside the field.
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-on-surface-muted" aria-hidden>
            HSN/SAC
          </span>
          <Input
            id={id}
            aria-label="HSN/SAC"
            value={value}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-8 pl-[4.25rem] text-[13px] tabular-nums"
          />
        </div>
        {error && (
          <p id={`${id}-error`} role="alert" className="text-[12px] text-overdue">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-on-surface-muted">
        HSN/SAC
      </label>
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        maxLength={8}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-overdue">
          {error}
        </p>
      )}
    </div>
  );
}
