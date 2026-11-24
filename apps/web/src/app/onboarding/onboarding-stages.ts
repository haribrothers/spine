/**
 * US-ONB-22 (D-208) — the wizard's eight steps grouped into four stages, with
 * how long each takes and the tip shown under its form. The order is the
 * order the steps run in (US-ONB-01).
 */
import { t } from "../../lib/i18n";

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
    label: t("onboarding.stages.business.label"),
    line: t("onboarding.stages.business.line"),
    steps: [
      {
        key: "profile",
        label: t("onboarding.stepList.profile.label"),
        minutes: 1,
        tip: {
          title: t("onboarding.tipTitles.whyThisMatters"),
          body: t("onboarding.stepList.profile.tipBody"),
          where: t("onboarding.stepList.profile.tipWhere"),
        },
      },
      {
        key: "template",
        label: t("onboarding.stepList.template.label"),
        minutes: 0.5,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.template.tipBody"),
          where: t("onboarding.stepList.template.tipWhere"),
        },
      },
    ],
  },
  {
    key: "money",
    label: t("onboarding.stages.money.label"),
    line: t("onboarding.stages.money.line"),
    steps: [
      {
        key: "currency",
        label: t("onboarding.stepList.currency.label"),
        minutes: 0.5,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.currency.tipBody"),
          where: t("onboarding.stepList.currency.tipWhere"),
        },
      },
      {
        key: "fiscal_year",
        label: t("onboarding.stepList.fiscalYear.label"),
        minutes: 0.5,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.fiscalYear.tipBody"),
          where: t("onboarding.stepList.fiscalYear.tipWhere"),
        },
      },
      {
        key: "tax",
        label: t("onboarding.stepList.tax.label"),
        minutes: 1,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.tax.tipBody"),
          where: t("onboarding.stepList.tax.tipWhere"),
        },
      },
    ],
  },
  {
    key: "documents",
    label: t("onboarding.stages.documents.label"),
    line: t("onboarding.stages.documents.line"),
    steps: [
      {
        key: "numbering",
        label: t("onboarding.stepList.numbering.label"),
        minutes: 1,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.numbering.tipBody"),
          where: t("onboarding.stepList.numbering.tipWhere"),
        },
      },
    ],
  },
  {
    key: "books",
    label: t("onboarding.stages.books.label"),
    line: t("onboarding.stages.books.line"),
    steps: [
      {
        key: "accounts",
        label: t("onboarding.stepList.accounts.label"),
        minutes: 0.5,
        tip: {
          title: t("onboarding.tipTitles.goodToKnow"),
          body: t("onboarding.stepList.accounts.tipBody"),
          where: t("onboarding.stepList.accounts.tipWhere"),
        },
      },
      {
        key: "team",
        label: t("onboarding.stepList.team.label"),
        minutes: 1,
        tip: {
          title: t("onboarding.tipTitles.whoSeesWhat"),
          body: t("onboarding.stepList.team.tipBody"),
          where: t("onboarding.stepList.team.tipWhere"),
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
