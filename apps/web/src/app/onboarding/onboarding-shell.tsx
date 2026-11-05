"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Check, Circle, CircleCheck, CircleDot, Clock, Lightbulb } from "lucide-react";
import { Button, SpineLogo } from "@spine/ui";
import { ThemeToggle } from "../../components/theme-toggle";
import { ONBOARDING_STAGES, ONBOARDING_STEPS, minutesLeft, stepPosition, type OnboardingStepKey } from "./onboarding-stages";
import styles from "./onboarding-illustration.module.css";
import { useT } from "../../lib/i18n";

function Progress({ value }: { value: number }) {
  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
      <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(value, 4)}%` }} />
    </div>
  );
}

/** US-ONB-22 — the four stages and their steps, ticked off as they're done, and the minutes left. */
function OnboardingRail({ current }: { current: OnboardingStepKey }) {
  const t = useT();
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.key === current);
  const { progress } = stepPosition(current);
  return (
    <nav aria-label={t("onboarding.shell.railLabel")} className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-5 py-6 lg:flex">
      <SpineLogo variant="horizontal" size={96} />
      <p className="mt-7 text-[13px] font-semibold text-on-surface">{t("onboarding.shell.setUpSpine")}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-on-surface-muted">
        <Clock size={13} aria-hidden />
        {t("onboarding.shell.minutesLeft", { minutes: minutesLeft(current) })}
      </p>
      <Progress value={progress} />
      <ol className="mt-5 flex flex-col gap-1.5">
        {ONBOARDING_STAGES.map((stage, i) => {
          const indexes = stage.steps.map((s) => ONBOARDING_STEPS.findIndex((x) => x.key === s.key));
          // eslint-disable-next-line i18next/no-literal-string -- state keys, not copy
          const state = Math.max(...indexes) < currentIndex ? "done" : indexes.includes(currentIndex) ? "current" : "todo";
          return (
            <li key={stage.key} className="py-2">
              <div className={`flex items-center gap-2.5 text-[14px] font-semibold ${state === "todo" ? "text-on-surface-muted" : "text-on-surface"}`}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    state === "done"
                      ? "bg-paid-bg text-paid"
                      : state === "current"
                        ? "bg-primary text-on-primary"
                        : "border-[1.5px] border-border-strong text-on-surface-muted"
                  }`}
                  aria-hidden
                >
                  {state === "done" ? <Check size={13} /> : i + 1}
                </span>
                {stage.label}
              </div>
              <ol className="ml-[11px] mt-1.5 flex flex-col gap-0.5 border-l-[1.5px] border-border pl-[13px]">
                {stage.steps.map((step) => {
                  const index = ONBOARDING_STEPS.findIndex((s) => s.key === step.key);
                  const done = index < currentIndex;
                  const isCurrent = index === currentIndex;
                  const Icon = done ? CircleCheck : isCurrent ? CircleDot : Circle;
                  return (
                    <li
                      key={step.key}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                        isCurrent ? "bg-info-bg font-semibold text-primary" : done ? "text-on-surface" : "text-on-surface-muted"
                      }`}
                    >
                      <Icon size={14} aria-hidden className={done ? "text-paid" : undefined} />
                      {step.label}
                      {done && <span className="sr-only">{t("onboarding.shell.done")}</span>}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
      <div className="mt-auto">
        <ThemeToggle placement="inline" />
      </div>
    </nav>
  );
}

/** Below 1024 px the rail becomes a bar: the stage, the minutes left and a progress line. */
function OnboardingTopBar({ current }: { current: OnboardingStepKey }) {
  const t = useT();
  const { stage, stageNumber, progress } = stepPosition(current);
  return (
    <header className="border-b border-border bg-surface px-5 pb-3 pt-3.5 lg:hidden">
      <div className="flex items-center justify-between">
        <SpineLogo variant="horizontal" size={82} />
        <ThemeToggle placement="inline" />
      </div>
      <p className="mt-2.5 text-[13px] font-semibold text-on-surface">
        {t("onboarding.shell.stageOf", { stage: stageNumber, total: ONBOARDING_STAGES.length, label: stage.label })}{" "}
        <span className="font-normal text-on-surface-muted">{t("onboarding.shell.minutesLeftAfterDot", { minutes: minutesLeft(current) })}</span>
      </p>
      <Progress value={progress} />
    </header>
  );
}

/** Why the step matters and where to change it later (US-ONB-22). */
function StepTip({ current }: { current: OnboardingStepKey }) {
  const t = useT();
  const { tip } = stepPosition(current).step;
  return (
    <aside aria-label={t("onboarding.shell.tip")} data-testid="onboarding-tip" className="mt-[18px] flex gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3.5">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-due-soon-bg text-due-soon">
        <Lightbulb size={16} aria-hidden />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-on-surface">{tip.title}</p>
        <p className="mt-0.5 text-[13px] leading-normal text-on-surface-muted">{tip.body}</p>
        <p className="mt-1.5 text-[12px] font-medium text-primary">{tip.where}</p>
      </div>
    </aside>
  );
}

/**
 * US-ONB-22 (D-208) — the wizard around each step: the rail (or the bar on
 * narrow windows), "Stage n of 4 · <stage> · Step n of n" and Back above the
 * step, its tip below, and the live preview beside it from 1280 px.
 */
export function OnboardingShell({
  current,
  onBack,
  preview,
  children,
}: {
  current: OnboardingStepKey;
  onBack?: () => void;
  preview: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const { stage, stageNumber, stepNumber } = stepPosition(current);
  return (
    // The page scrolls here: globals.css stops the body scrolling. The rail and the preview stay in place.
    <div
      data-testid="onboarding-scroll"
      className="h-screen overflow-y-auto bg-background lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start xl:grid-cols-[264px_minmax(0,1fr)_440px]"
    >
      <OnboardingRail current={current} />
      <OnboardingTopBar current={current} />
      <main className="px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
        <div className="mx-auto w-full max-w-[580px]">
          <div className="flex min-h-8 items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3">
                <ArrowLeft size={14} aria-hidden />
                {t("onboarding.shell.back")}
              </Button>
            )}
            <p className="text-[12px] font-semibold tracking-[0.02em] text-primary" data-testid="onboarding-position">
              {t("onboarding.shell.position", { stage: stageNumber, total: ONBOARDING_STAGES.length, label: stage.label, step: stepNumber, steps: stage.steps.length })}
            </p>
          </div>
          {children}
          <StepTip current={current} />
        </div>
      </main>
      <aside className="sticky top-0 hidden xl:block">
        <div className={`${styles.previewPanel} m-4 ml-0 px-[26px] py-7`}>{preview}</div>
      </aside>
    </div>
  );
}

/** A step's heading, the line under it and its form, in the wizard's card. */
export function StepCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="mt-1.5">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
      <p className="mt-2 text-[14px] leading-normal text-on-surface-muted">{description}</p>
      <div className="mt-5 rounded-[14px] border border-border bg-surface p-[22px]">{children}</div>
    </section>
  );
}
