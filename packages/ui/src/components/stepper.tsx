import { Check } from "lucide-react";
import { cn } from "../lib/cn";

export interface StepperStepDef {
  key: string;
  label: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepperStepDef[];
  currentIndex: number;
}

/**
 * Numbered progress indicator for linear multi-step flows (wizards, checkout-style forms).
 * Purely presentational — indicates progress, not a set of interactive controls: steps
 * aren't clickable and carry no button semantics. Rendered as a `role="list"` of status
 * text, not a nav of activatable steps.
 *
 * Horizontal layout only — no current call site needs vertical, so no `orientation`
 * prop is exposed; add one (following the pattern in separator.tsx) if that changes.
 */
export function Stepper({ steps, currentIndex, className, ...props }: StepperProps) {
  return (
    <ol
      aria-label="Progress"
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-2 text-[12px]", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li
            key={step.key}
            className="flex items-center gap-1"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                isComplete && "border-primary bg-primary text-on-primary",
                isCurrent && !isComplete && "border-primary text-primary",
                !isComplete && !isCurrent && "border-border-strong text-on-surface-muted",
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn("hidden sm:inline", isCurrent ? "font-medium text-on-surface" : "text-on-surface-muted")}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="mx-1.5 h-px w-4 shrink-0 bg-border-strong sm:mx-2 sm:w-6" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
