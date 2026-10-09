"use client";

import { Circle, CircleCheck } from "lucide-react";
import { PASSWORD_CHECK_LABELS, PASSWORD_LEVEL_LABELS, passwordStrength, type PasswordChecks } from "@spine/shared";
import { cn } from "../lib/cn";

export interface PasswordStrengthMeterProps {
  password: string;
  /** Show the checklist under the meter (default true). */
  checklist?: boolean;
  className?: string;
  id?: string;
}

const FILL: Record<number, string> = { 1: "bg-overdue", 2: "bg-due-soon", 3: "bg-primary", 4: "bg-paid" };

/**
 * US-AUTH-15 (D-207) — how strong a new password is: a four-part meter,
 * "Password strength: <level>" (announced politely to screen readers) and a
 * checklist that ticks off as the password improves. The levels and
 * checks come from `@spine/shared`'s `passwordStrength`, the same rules the
 * server uses for its refusals.
 */
export function PasswordStrengthMeter({ password, checklist = true, className, id }: PasswordStrengthMeterProps) {
  const strength = passwordStrength(password);
  const label = PASSWORD_LEVEL_LABELS[strength.level];
  return (
    <div id={id} className={cn("flex flex-col gap-1.5", className)} data-level={strength.level}>
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((part) => (
          <span key={part} className={cn("h-1 rounded-full", password && part <= strength.score ? FILL[strength.score] : "bg-border")} />
        ))}
      </div>
      <p className="text-[12px] font-medium text-on-surface-muted" role="status" aria-live="polite">
        {password ? (
          <>
            Password strength: <span className="font-semibold text-on-surface">{label}</span>
          </>
        ) : (
          "Password strength"
        )}
      </p>
      {checklist ? (
        <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {(Object.keys(PASSWORD_CHECK_LABELS) as (keyof PasswordChecks)[]).map((key) => {
            const ok = Boolean(password) && strength.checks[key];
            return (
              <li key={key} className={cn("flex items-center gap-1.5 text-[12px]", ok ? "text-on-surface" : "text-on-surface-muted")}>
                {ok ? <CircleCheck size={14} className="shrink-0 text-paid" aria-hidden /> : <Circle size={14} className="shrink-0" aria-hidden />}
                <span>
                  {PASSWORD_CHECK_LABELS[key]}
                  <span className="sr-only">{ok ? " (done)" : " (not yet)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
