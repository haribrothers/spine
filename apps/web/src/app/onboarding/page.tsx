"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import { BusinessProfileStep, type BusinessProfileValue } from "./steps/business-profile-step";
import { WelcomeStep } from "./steps/welcome-step";
import { IndustryTemplateStep, type IndustryTemplate } from "./steps/industry-template-step";
import { CurrencyLocaleStep, type CurrencyLocaleValue } from "./steps/currency-locale-step";
import { FinancialYearStep, type FinancialYearValue } from "./steps/financial-year-step";
import { TaxRateStep, type TaxRateValue } from "./steps/tax-rate-step";
import { NumberingStep, type NumberingSequenceValue } from "./steps/numbering-step";
import { ChartOfAccountsStep, type AccountsByType } from "./steps/chart-of-accounts-step";
import { InviteTeamStep, type MemberRole } from "./steps/invite-team-step";
import { WizardStepper, type WizardStepDef } from "./wizard-stepper";

const STEP_DEFS: WizardStepDef[] = [
  { key: "profile", label: "Business" },
  { key: "template", label: "Template" },
  { key: "currency", label: "Currency" },
  { key: "fiscal_year", label: "Fiscal year" },
  { key: "tax", label: "Tax" },
  { key: "numbering", label: "Numbering" },
  { key: "accounts", label: "Accounts" },
  { key: "team", label: "Team" },
];

type Step = "welcome" | (typeof STEP_DEFS)[number]["key"];

/**
 * The onboarding wizard shell (F12 / FEAT-12). Linear, always-skippable —
 * every step renders a "Skip to dashboard" action that marks onboarding
 * skipped and routes straight to /dashboard, per PRD's "MUST NOT require
 * the wizard to be completed before the app is usable".
 *
 * State is intentionally not centralized into one big form: each step
 * loads only the settings it needs on mount and saves immediately via its
 * own onSave, so a partial run through the wizard (someone closes the tab
 * halfway) still leaves everything they did complete persisted, not lost
 * in unsaved local state.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);

  async function markOnboardingStatus(status: { completedSteps?: string[]; skipped?: boolean; completedAt?: string }) {
    await apiClient.put("/org/settings/onboarding_status", { value: status });
  }

  function goToDashboard() {
    router.push("/dashboard");
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await markOnboardingStatus({ skipped: true });
    } finally {
      goToDashboard();
    }
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await markOnboardingStatus({ skipped: false, completedAt: new Date().toISOString() });
    } finally {
      goToDashboard();
    }
  }

  const currentIndex = STEP_DEFS.findIndex((s) => s.key === step);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-4 py-10">
      {step !== "welcome" && (
        <div className="w-full max-w-2xl">
          <WizardStepper steps={STEP_DEFS} currentIndex={currentIndex} />
        </div>
      )}

      {step === "welcome" && (
        <WelcomeStep
          onStartManual={() => setStep("profile")}
          onUseDemoDefaults={handleSkip}
          onSkip={handleSkip}
        />
      )}

      {step === "profile" && (
        <StepCard title="Tell us about your business" description="Name, logo and address — shown on quotes and invoices.">
          <ProfileStepBody onSaved={() => setStep("template")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "template" && (
        <StepCard title="Pick an industry template" description="Pre-sets sensible defaults — you can change anything later.">
          <TemplateStepBody onSaved={() => setStep("currency")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "currency" && (
        <StepCard title="Currency & locale" description="Used for every document and report from now on.">
          <CurrencyStepBody onSaved={() => setStep("fiscal_year")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "fiscal_year" && (
        <StepCard title="Financial year" description="Number sequences reset annually on this date by default.">
          <FiscalYearStepBody onSaved={() => setStep("tax")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "tax" && (
        <StepCard title="Default tax rate" description="Confirm the rate your first quote should use.">
          <TaxStepBody onSaved={() => setStep("numbering")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "numbering" && (
        <StepCard title="Document numbering" description="Prefix and starting number for each document type.">
          <NumberingStepBody onSaved={() => setStep("accounts")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "accounts" && (
        <StepCard title="Chart of accounts" description="This is what we'll post your transactions to. System accounts can't be renamed.">
          <AccountsStepBody onSaved={() => setStep("team")} onSkip={handleSkip} />
        </StepCard>
      )}

      {step === "team" && (
        <StepCard title="Invite your team" description="Optional — you can always invite people later from Settings.">
          <InviteTeamStep
            onInvite={(email, role) => apiClient.post("/org/invitations", { email, role })}
            onFinish={handleFinish}
          />
        </StepCard>
      )}

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-background/60">
          <Spinner />
        </div>
      )}
    </main>
  );
}

function StepCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function useSettingsValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ key: string; value: T | null }>(`/org/settings/${key}`)
      .then((res) => {
        if (!cancelled && res.value !== null) {
          setValue(res.value);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { value, ready };
}

function ProfileStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const { value, ready } = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
  if (!ready) return <StepLoading />;
  return (
    <BusinessProfileStep
      initialValue={value}
      onSave={async (v) => {
        await apiClient.put("/org/settings/business_profile", { value: v });
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function TemplateStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const { value, ready } = useSettingsValue<{ template: IndustryTemplate }>("industry_template", { template: "generic" });
  if (!ready) return <StepLoading />;
  return (
    <IndustryTemplateStep
      initialValue={value.template}
      onSave={async (template) => {
        await apiClient.put("/org/settings/industry_template", { value: { template } });
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function CurrencyStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const { value, ready } = useSettingsValue<CurrencyLocaleValue>("currency", { code: "USD", locale: "en-US" });
  if (!ready) return <StepLoading />;
  return (
    <CurrencyLocaleStep
      initialValue={value}
      onSave={async (v) => {
        await apiClient.put("/org/settings/currency", { value: v });
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function FiscalYearStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const { value, ready } = useSettingsValue<FinancialYearValue>("financial_year_start", { month: 1, day: 1 });
  if (!ready) return <StepLoading />;
  return (
    <FinancialYearStep
      initialValue={value}
      onSave={async (v) => {
        await apiClient.put("/org/settings/financial_year_start", { value: v });
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function TaxStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const [value, setValue] = useState<TaxRateValue>({ name: "Tax", percentage: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<TaxRateValue>("/org/tax/default-rate")
      .then((res) => {
        if (!cancelled) setValue(res);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <StepLoading />;
  return (
    <TaxRateStep
      initialValue={value}
      onSave={async (v) => {
        await apiClient.put("/org/tax/default-rate", v);
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function NumberingStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const [rows, setRows] = useState<NumberingSequenceValue[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ documentType: string; prefix: string; padding: number; nextValue: number }[]>("/org/numbering")
      .then((res) => {
        if (!cancelled) setRows(res);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) return <StepLoading />;
  return (
    <NumberingStep
      initialValue={rows}
      onSave={async (values) => {
        await Promise.all(
          values.map((row) =>
            apiClient.put(`/org/numbering/${row.documentType}`, {
              prefix: row.prefix,
              padding: row.padding,
              nextValue: row.nextValue,
            }),
          ),
        );
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function AccountsStepBody({ onSaved, onSkip }: { onSaved: () => void; onSkip: () => void }) {
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<AccountsByType>("/org/accounts").then((res) => {
      if (!cancelled) setAccounts(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!accounts) return <StepLoading />;
  return (
    <ChartOfAccountsStep
      accounts={accounts}
      onRename={async (accountId, name) => {
        await apiClient.put(`/org/accounts/${accountId}`, { name });
        setAccounts((prev) => {
          if (!prev) return prev;
          const next: AccountsByType = {};
          for (const [type, rows] of Object.entries(prev)) {
            next[type] = rows.map((row) => (row.id === accountId ? { ...row, name } : row));
          }
          return next;
        });
      }}
      onContinue={onSaved}
      onSkip={onSkip}
    />
  );
}

function StepLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Spinner />
    </div>
  );
}

export type { MemberRole };
