"use client";

import { cn } from "@spine/ui";

export interface WizardStepDef {
  key: string;
  label: string;
}

export interface WizardStepperProps {
  steps: WizardStepDef[];
  currentIndex: number;
}

/**
 * No dedicated stepper/wizard-progress component exists in @spine/ui
 * (checked packages/ui/src/components — confirmed absent) — composed here
 * from plain markup + lucide's Check icon + @spine/ui's `cn` helper and
 * design tokens, per the task brief's instruction to compose rather than
 * invent a new exported primitive for a single call site. If a second
 * wizard-shaped flow shows up later, this is the natural candidate to
 * promote into packages/ui/src/components/stepper.tsx with a doc page.
 * Uses a plain "✓" glyph rather than a lucide icon since apps/web doesn't
 * declare `lucide-react` as its own dependency (it's a transitive dep of
 * @spine/ui, not something this app should reach past that package for).
 */
export function WizardStepper({ steps, currentIndex }: WizardStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[12px]">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-1">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                isComplete && "border-primary bg-primary text-white",
                isCurrent && !isComplete && "border-primary text-primary",
                !isComplete && !isCurrent && "border-border-strong text-on-surface-muted",
              )}
            >
              {isComplete ? "✓" : index + 1}
            </span>
            <span className={cn("hidden sm:inline", isCurrent ? "font-medium text-on-surface" : "text-on-surface-muted")}>
              {step.label}
            </span>
            {index < steps.length - 1 && <span className="mx-1.5 h-px w-4 shrink-0 bg-border-strong sm:mx-2 sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}
