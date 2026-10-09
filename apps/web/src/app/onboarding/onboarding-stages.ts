/**
 * US-ONB-22 (D-208) — the wizard's eight steps grouped into four stages, with
 * how long each takes and the tip shown under its form. The order is the
 * order the steps run in (US-ONB-01).
 */
export type OnboardingStepKey = "profile" | "template" | "currency" | "fiscal_year" | "tax" | "numbering" | "accounts" | "team";
export type OnboardingStageKey = "business" | "money" | "documents" | "books";

export interface OnboardingStep {
  key: OnboardingStepKey;
  /** The step's name in the rail. */
  label: string;
  /** Roughly how long it takes, for "About <n> min left". */
  minutes: number;
  tip: { title: string; body: string; where: string };
}

export interface OnboardingStage {
  key: OnboardingStageKey;
  label: string;
  /** One line on the start screen. */
  line: string;
  steps: OnboardingStep[];
}

export const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    key: "business",
    label: "Business",
    line: "Your name, logo and kind of work",
    steps: [
      {
        key: "profile",
        label: "Details",
        minutes: 1,
        tip: {
          title: "Why this matters",
          body: "Your name, logo and address go on every quote, invoice and email from the first one. A square logo looks sharpest.",
          where: "Change it later in Settings › Business profile.",
        },
      },
      {
        key: "template",
        label: "Template",
        minutes: 0.5,
        tip: {
          title: "Good to know",
          body: "A template only sets things up for you — cost categories, and whether jobs are on. It never takes anything away.",
          where: "Change it later in Settings › Industry template.",
        },
      },
    ],
  },
  {
    key: "money",
    label: "Money",
    line: "Currency, financial year and tax",
    steps: [
      {
        key: "currency",
        label: "Currency",
        minutes: 0.5,
        tip: {
          title: "Good to know",
          body: "Spine uses one currency for everything. The locale decides how dates and numbers look — ₹1,25,000.00 in India, $125,000.00 in the US.",
          where: "Change it later in Settings › Currency & locale.",
        },
      },
      {
        key: "fiscal_year",
        label: "Financial year",
        minutes: 0.5,
        tip: {
          title: "Good to know",
          body: "Reports and year-end use this date. Your quote and invoice numbers carry on from one year to the next.",
          where: "Change it later in Settings › Financial year.",
        },
      },
      {
        key: "tax",
        label: "Tax",
        minutes: 1,
        tip: {
          title: "Good to know",
          body: "Pick your country and Spine adds its rates. You choose the rate on each line of a quote or invoice.",
          where: "Change it later in Settings › Tax.",
        },
      },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    line: "How your quotes and invoices are numbered",
    steps: [
      {
        key: "numbering",
        label: "Numbering",
        minutes: 1,
        tip: {
          title: "Good to know",
          body: "Each number is given once, in order, and never reused. Moving from another system? Start where your old numbers stopped — say 1042.",
          where: "Change it later in Settings › Numbering.",
        },
      },
    ],
  },
  {
    key: "books",
    label: "Books & team",
    line: "Your accounts and the people you work with",
    steps: [
      {
        key: "accounts",
        label: "Accounts",
        minutes: 0.5,
        tip: {
          title: "Good to know",
          body: "Spine posts to these accounts for you — you never write journal entries by hand. Rename any account that isn't a system account.",
          where: "Change it later in Settings › Chart of accounts.",
        },
      },
      {
        key: "team",
        label: "Team",
        minutes: 1,
        tip: {
          title: "Who sees what",
          body: "Staff see what their Team allows. Field users get the phone app for their jobs and never see your money.",
          where: "Invite or change people later in Team › Users.",
        },
      },
    ],
  },
];

export const ONBOARDING_STEPS: OnboardingStep[] = ONBOARDING_STAGES.flatMap((stage) => stage.steps);

export interface StepPosition {
  step: OnboardingStep;
  stage: OnboardingStage;
  stageNumber: number;
  stepNumber: number;
  /** 0–100, the share of the steps before this one. */
  progress: number;
}

export function stepPosition(key: OnboardingStepKey): StepPosition {
  const stageIndex = ONBOARDING_STAGES.findIndex((stage) => stage.steps.some((s) => s.key === key));
  const stage = ONBOARDING_STAGES[stageIndex]!;
  const stepIndex = stage.steps.findIndex((s) => s.key === key);
  const flatIndex = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  return {
    step: stage.steps[stepIndex]!,
    stage,
    stageNumber: stageIndex + 1,
    stepNumber: stepIndex + 1,
    progress: Math.round((flatIndex / ONBOARDING_STEPS.length) * 100),
  };
}

/** "About <n> min left" from this step on, counting this step; never less than 1. */
export function minutesLeft(key: OnboardingStepKey): number {
  const from = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  const total = ONBOARDING_STEPS.slice(from).reduce((sum, s) => sum + s.minutes, 0);
  return Math.max(1, Math.ceil(total));
}

export const TOTAL_MINUTES = minutesLeft("profile");

export function previousStep(key: OnboardingStepKey): OnboardingStepKey | null {
  const i = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  return i > 0 ? ONBOARDING_STEPS[i - 1]!.key : null;
}

export function nextStep(key: OnboardingStepKey): OnboardingStepKey | null {
  const i = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  return i >= 0 && i < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[i + 1]!.key : null;
}
