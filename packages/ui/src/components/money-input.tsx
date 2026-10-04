"use client";

import { fromDecimalString, toDecimalString } from "@spine/shared/money";
import { forwardRef, useEffect, useState } from "react";
import { cn } from "../lib/cn";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Minor units — never a float, per docs/archive/spine-prd.md §6.4. */
  value: bigint;
  onValueChange: (amount: bigint) => void;
  currency: string;
  error?: boolean;
}

/**
 * Currency/minor-unit-aware amount field (§F0). Right-aligned, mono-data
 * typography so a column of amounts aligns on the decimal, and rejects any
 * keystroke that would produce more fractional digits than the currency
 * supports — the field can never hold more precision than the ledger does.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onValueChange, currency, error = false, onBlur, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const [text, setText] = useState(() => toDecimalString({ amount: value, currency }));

    useEffect(() => {
      setText(toDecimalString({ amount: value, currency }));
    }, [value, currency]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        aria-invalid={ariaInvalid ?? (error ? true : undefined)}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = fromDecimalString(next, currency);
          if (parsed !== null) {
            onValueChange(parsed);
          }
        }}
        onBlur={(event) => {
          // Snap back to the canonical formatting (e.g. "5" -> "5.00") on blur.
          setText(toDecimalString({ amount: value, currency }));
          onBlur?.(event);
        }}
        className={cn(
          "h-10 w-full rounded-sm border bg-surface px-2.5 text-right text-[14px] tabular-nums text-on-surface placeholder:text-on-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-overdue" : "border-border-strong",
          className,
        )}
        {...props}
      />
    );
  },
);

MoneyInput.displayName = "MoneyInput";
