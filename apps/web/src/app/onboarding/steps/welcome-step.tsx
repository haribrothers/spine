"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@spine/ui";
import { ONBOARDING_STAGES, TOTAL_MINUTES } from "../onboarding-stages";

export interface WelcomeStepProps {
  /** The owner's name, for "Welcome to Spine, <first name>". */
  ownerName?: string | null;
  onStartManual: () => void;
  onUseDemoDefaults: () => void;
  onSkip: () => void;
}

/**
 * Wizard-entry screen, before step 1 (US-ONB-01, US-ONB-22): the four
 * stages, then set up the business, explore a demo business ("Just show me
 * around" opens the country and industry picker, US-ONB-18) or go straight
 * to the dashboard. The onboarding page puts it in the signed-out frame with
 * Spine drawn small beside it.
 */
export function WelcomeStep({ ownerName, onStartManual, onUseDemoDefaults, onSkip }: WelcomeStepProps) {
  const firstName = ownerName?.trim().split(/\s+/)[0];
  return (
    <div className="flex flex-col">
      <h1 className="text-[32px] font-bold leading-tight tracking-tight text-on-surface">{firstName ? `Welcome to Spine, ${firstName}` : "Welcome to Spine"}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-on-surface-muted">
        Four short stages, about {TOTAL_MINUTES} minutes. Skip anything — it&apos;s all in Settings later.
      </p>
      <ol className="mt-6 flex flex-col gap-3">
        {ONBOARDING_STAGES.map((stage, i) => (
          <li key={stage.key} className="flex items-start gap-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong text-[11px] font-semibold text-on-surface-muted" aria-hidden>
              {i + 1}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-on-surface">{stage.label}</p>
              <p className="text-[13px] text-on-surface-muted">{stage.line}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-col gap-2.5">
        <Button size="touch" onClick={onStartManual}>
          Set up my business
          <ArrowRight size={16} aria-hidden />
        </Button>
        <Button size="touch" variant="secondary" onClick={onUseDemoDefaults}>
          Just show me around (use defaults)
        </Button>
        <Button size="touch" variant="ghost" onClick={onSkip}>
          Skip to dashboard
        </Button>
      </div>
    </div>
  );
}
