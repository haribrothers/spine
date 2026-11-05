"use client";

import { ArrowBigUp } from "lucide-react";
import { forwardRef, useId, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { PasswordToggleField, PasswordToggleFieldInput, PasswordToggleFieldToggle } from "./password-toggle-field";

export interface PasswordInputProps extends Omit<React.ComponentPropsWithoutRef<typeof PasswordToggleFieldInput>, "type"> {
  /** Say "Caps Lock is on." under the field while it is (default true). */
  capsLockHint?: boolean;
}

/**
 * US-AUTH-14, US-AUTH-15 (D-207) — a password field with the show/hide eye
 * ("Show password" / "Hide password") and, while typing with Caps Lock on, a
 * "Caps Lock is on." line the field points to. Spreads FormField's render
 * props like any input.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, capsLockHint = true, onKeyDown, onKeyUp, onBlur, "aria-describedby": describedBy, ...props }, ref) => {
    const t = useT();
    const [capsLock, setCapsLock] = useState(false);
    const hintId = `${useId()}-caps`;
    const track = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (capsLockHint && typeof event.getModifierState === "function") setCapsLock(event.getModifierState("CapsLock"));
    };
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <PasswordToggleField>
          <div className="relative">
            <PasswordToggleFieldInput
              ref={ref}
              aria-describedby={[describedBy, capsLock ? hintId : undefined].filter(Boolean).join(" ") || undefined}
              onKeyDown={(event) => {
                track(event);
                onKeyDown?.(event);
              }}
              onKeyUp={(event) => {
                track(event);
                onKeyUp?.(event);
              }}
              onBlur={(event) => {
                setCapsLock(false);
                onBlur?.(event);
              }}
              {...props}
            />
            <PasswordToggleFieldToggle />
          </div>
        </PasswordToggleField>
        {capsLock ? (
          <p id={hintId} className="flex items-center gap-1.5 text-[12px] text-due-soon">
            <ArrowBigUp size={14} aria-hidden />
            {t("ui.passwordInput.capsLockOn")}
          </p>
        ) : null}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
