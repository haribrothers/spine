"use client";

import { useId } from "react";
import { Input } from "@spine/ui";
import { HSN_SAC_MESSAGE, isValidHsnSac } from "@spine/shared";

/** US-TAX-14 — a document line's HSN/SAC code (4, 6 or 8 digits), copied from its item. */
export function HsnSacField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const error = value && !isValidHsnSac(value) ? HSN_SAC_MESSAGE : null;
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
