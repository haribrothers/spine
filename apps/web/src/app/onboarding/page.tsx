"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@spine/ui";
import { formatDocumentNumber, taxCountryLabel, type TaxCountry, type TaxProfile } from "@spine/shared";
import { apiClient } from "../../lib/api-client";
import { authClient } from "../../lib/auth-client";
import { AuthFrame } from "../../components/auth-frame";
import { DemoBusinessDialog } from "../../components/demo-business-dialog";
import { BusinessProfileStep, type BusinessProfileValue } from "./steps/business-profile-step";
import { WelcomeStep } from "./steps/welcome-step";
import { FinishStep } from "./steps/finish-step";
import { IndustryTemplateStep, type IndustryTemplate } from "./steps/industry-template-step";
import { CurrencyLocaleStep, type CurrencyLocaleValue } from "./steps/currency-locale-step";
import { FinancialYearStep, type FinancialYearValue } from "./steps/financial-year-step";
import { TaxRateStep, type TaxRateValue } from "./steps/tax-rate-step";
import { TaxCountryStep, taxCountryForCurrency } from "./steps/tax-country-step";
import { GstRegistrationForm } from "../settings/panes/gst-pane";
import { NumberingStep, type NumberingSequenceValue } from "./steps/numbering-step";
import { ChartOfAccountsStep, type AccountsByType } from "./steps/chart-of-accounts-step";
import { InviteTeamStep, type MemberRole } from "./steps/invite-team-step";
import { OnboardingShell, StepCard } from "./onboarding-shell";
import { OnboardingPreview, presetTaxLine, type PreviewData } from "./onboarding-preview";
import { OnboardingFinishIllustration, OnboardingStartIllustration } from "./onboarding-illustration";
import { nextStep, previousStep, type OnboardingStepKey } from "./onboarding-stages";
import { useT } from "../../lib/i18n";

type Step = "welcome" | OnboardingStepKey | "done";

/** What's saved so far, read when the wizard opens and again after each step saves. */
interface Saved {
  business: BusinessProfileValue | null;
  currency: CurrencyLocaleValue | null;
  taxCountry: TaxCountry | null;
  defaultRate: TaxRateValue | null;
  invoiceSeries: NumberingSequenceValue | null;
  accounts: Record<string, number> | null;
}

/** What's typed or picked on the current step but not saved yet (US-ONB-22's live preview). */
interface Draft {
  business?: Pick<BusinessProfileValue, "name" | "logoUrl" | "address">;
  currency?: CurrencyLocaleValue;
  taxCountry?: TaxCountry;
  taxRate?: TaxRateValue;
  invoiceSeries?: NumberingSequenceValue;
}

const EMPTY_SAVED: Saved = { business: null, currency: null, taxCountry: null, defaultRate: null, invoiceSeries: null, accounts: null };

async function loadSaved(): Promise<Saved> {
  const [business, currency, profile, defaultRate, numbering, accounts] = await Promise.allSettled([
    apiClient.get<{ value: BusinessProfileValue | null }>("/org/settings/business_profile"),
    apiClient.get<{ value: CurrencyLocaleValue | null }>("/org/settings/currency"),
    apiClient.get<TaxProfile>("/org/tax/profile"),
    apiClient.get<TaxRateValue>("/org/tax/default-rate"),
    apiClient.get<NumberingSequenceValue[]>("/org/numbering"),
    apiClient.get<AccountsByType>("/org/accounts"),
  ]);
  const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
  const accountRows = ok(accounts);
  return {
    business: ok(business)?.value ?? null,
    currency: ok(currency)?.value ?? null,
    taxCountry: ok(profile)?.country ?? null,
    defaultRate: ok(defaultRate),
    invoiceSeries: ok(numbering)?.find((row) => row.documentType === "invoice") ?? null,
    accounts: accountRows ? Object.fromEntries(Object.values(accountRows).flat().reduce((m, a) => m.set(a.type, (m.get(a.type) ?? 0) + 1), new Map<string, number>())) : null,
  };
}

/**
 * The onboarding wizard (F12 / FEAT-12; US-ONB-22 and US-ONB-23, D-208).
 * Linear, always skippable — every step renders a "Skip to dashboard"
 * action that marks onboarding skipped and routes straight to /dashboard,
 * per PRD's "MUST NOT require the wizard to be completed before the app is
 * usable". The eight steps run in four stages, with a rail, a tip under each
 * step and a live preview of the first invoice; Finish ends on a finish
 * screen.
 *
 * State is intentionally not centralized into one big form: each step
 * loads only the settings it needs on mount and saves immediately via its
 * own onSave, so a partial run through the wizard (someone closes the tab
 * halfway) still leaves everything they did complete persisted. The page
 * only keeps what the preview needs: the saved values and the current
 * step's unsaved input.
 */
export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [step, setStep] = useState<Step>("welcome");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [saved, setSaved] = useState<Saved>(EMPTY_SAVED);
  const [draft, setDraft] = useState<Draft>({});
  const [invites, setInvites] = useState<{ email: string; role: MemberRole }[]>([]);

  // US-ONB-01, US-ONB-23: a finished or skipped onboarding goes to the dashboard, refreshes included.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ value: { skipped?: boolean; completedAt?: string } | null }>("/org/settings/onboarding_status")
      .then((res) => {
        if (cancelled) return;
        if (res.value?.skipped || res.value?.completedAt) router.replace("/dashboard");
        else setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Drafts stay: once a step saves, its draft equals what was saved, so the preview never flickers back.
  const refresh = useCallback(async () => {
    setSaved(await loadSaved());
  }, []);

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

  // US-ONB-18: the demo business is chosen in a dialog; once it's loaded, onboarding is skipped.
  async function handleDemoLoaded() {
    try {
      await markOnboardingStatus({ skipped: true });
    } finally {
      goToDashboard();
    }
  }

  // US-ONB-23: Finish marks onboarding done, then shows the finish screen rather than the dashboard.
  async function handleFinish() {
    setLoading(true);
    try {
      await markOnboardingStatus({ skipped: false, completedAt: new Date().toISOString() });
      await refresh();
      setStep("done");
    } catch {
      goToDashboard();
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setStep("profile");
    void refresh();
  }

  /** After a step saves: re-read what the preview shows, then move on. */
  function advance(from: OnboardingStepKey) {
    void refresh();
    const next = nextStep(from);
    if (next) setStep(next);
  }

  const preview: PreviewData = useMemo(() => {
    const currency = draft.currency ?? saved.currency ?? { code: "USD", locale: "en-US" };
    const country = draft.taxCountry ?? saved.taxCountry;
    const ownRate = draft.taxRate ?? (saved.defaultRate && saved.defaultRate.percentage > 0 ? saved.defaultRate : null);
    const tax =
      country && country !== "other" ? presetTaxLine(country) : ownRate ? { label: `${ownRate.name} ${ownRate.percentage}%`, percentage: ownRate.percentage } : null;
    const series = draft.invoiceSeries ?? saved.invoiceSeries ?? { documentType: "invoice", prefix: "INV", padding: 4, nextValue: 1 };
    return {
      business: { ...(saved.business ?? {}), ...(draft.business ?? {}) },
      currency,
      tax,
      invoiceNumber: formatDocumentNumber(series, series.nextValue),
      accounts: saved.accounts,
      owner: session?.user?.name ?? "",
      invites,
      taxCountryLabel: country && country !== "other" ? taxCountryLabel(country) : (tax?.label ?? null),
    };
  }, [saved, draft, invites, session]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <>
        <AuthFrame wide panel={<OnboardingStartIllustration />}>
          <WelcomeStep ownerName={session?.user?.name} onStartManual={start} onUseDemoDefaults={() => setDemoOpen(true)} onSkip={handleSkip} />
        </AuthFrame>
        <DemoBusinessDialog open={demoOpen} onOpenChange={setDemoOpen} onLoaded={handleDemoLoaded} />
        {loading && <Busy />}
      </>
    );
  }

  if (step === "done") {
    return (
      <AuthFrame wide panel={<OnboardingFinishIllustration />}>
        <FinishStep
          summary={{
            businessName: preview.business.name?.trim() || undefined,
            money: [preview.currency.code, preview.taxCountryLabel].filter(Boolean).join(" · "),
            invoiceNumber: preview.invoiceNumber,
            invitesSent: invites.length,
          }}
          onDashboard={goToDashboard}
        />
      </AuthFrame>
    );
  }

  const back = previousStep(step);
  return (
    <>
      <OnboardingShell current={step} onBack={back ? () => setStep(back) : undefined} preview={<OnboardingPreview step={step} data={preview} />}>
        {step === "profile" && (
          <StepCard title={t("onboarding.page.profileTitle")} description={t("onboarding.page.profileDescription")}>
            <ProfileStepBody
              onSaved={() => advance("profile")}
              onSkip={handleSkip}
              onChange={(business) => setDraft((d) => ({ ...d, business }))}
            />
          </StepCard>
        )}

        {step === "template" && (
          <StepCard title={t("onboarding.page.templateTitle")} description={t("onboarding.page.templateDescription")}>
            <TemplateStepBody onSaved={() => advance("template")} onSkip={handleSkip} />
          </StepCard>
        )}

        {step === "currency" && (
          <StepCard title={t("onboarding.page.currencyTitle")} description={t("onboarding.page.currencyDescription")}>
            <CurrencyStepBody
              onSaved={() => advance("currency")}
              onSkip={handleSkip}
              onChange={(currency) => setDraft((d) => ({ ...d, currency }))}
            />
          </StepCard>
        )}

        {step === "fiscal_year" && (
          <StepCard title={t("onboarding.page.fiscalYearTitle")} description={t("onboarding.page.fiscalYearDescription")}>
            <FiscalYearStepBody onSaved={() => advance("fiscal_year")} onSkip={handleSkip} />
          </StepCard>
        )}

        {step === "tax" && (
          <TaxStepBody
            onSaved={() => advance("tax")}
            onSkip={handleSkip}
            onCountryChange={(taxCountry) => setDraft((d) => ({ ...d, taxCountry, taxRate: undefined }))}
            onRateChange={(taxRate) => setDraft((d) => ({ ...d, taxRate }))}
            onCountrySaved={() => void refresh()}
          />
        )}

        {step === "numbering" && (
          <StepCard title={t("onboarding.page.numberingTitle")} description={t("onboarding.page.numberingDescription")}>
            <NumberingStepBody
              onSaved={() => advance("numbering")}
              onSkip={handleSkip}
              onChange={(rows) => setDraft((d) => ({ ...d, invoiceSeries: rows.find((row) => row.documentType === "invoice") }))}
            />
          </StepCard>
        )}

        {step === "accounts" && (
          <StepCard title={t("onboarding.page.accountsTitle")} description={t("onboarding.page.accountsDescription")}>
            <AccountsStepBody onSaved={() => advance("accounts")} onSkip={handleSkip} />
          </StepCard>
        )}

        {step === "team" && (
          <StepCard title={t("onboarding.page.teamTitle")} description={t("onboarding.page.teamDescription")}>
            <InviteTeamStep
              onInvite={async (email, role) => {
                await apiClient.post("/org/invitations", { email, role });
                setInvites((prev) => [...prev, { email, role }]);
              }}
              onFinish={handleFinish}
            />
          </StepCard>
        )}
      </OnboardingShell>
      {loading && <Busy />}
    </>
  );
}

function Busy() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/60">
      <Spinner />
    </div>
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

function ProfileStepBody({
  onSaved,
  onSkip,
  onChange,
}: {
  onSaved: () => void;
  onSkip: () => void;
  onChange: (value: Pick<BusinessProfileValue, "name" | "logoUrl" | "address">) => void;
}) {
  const { value, ready } = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
  if (!ready) return <StepLoading />;
  return (
    <BusinessProfileStep
      initialValue={value}
      onChange={onChange}
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
      modulesNote="onboarding"
      onSave={async (template) => {
        await apiClient.put("/org/settings/industry_template", { value: { template } });
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function CurrencyStepBody({ onSaved, onSkip, onChange }: { onSaved: () => void; onSkip: () => void; onChange: (value: CurrencyLocaleValue) => void }) {
  const { value, ready } = useSettingsValue<CurrencyLocaleValue>("currency", { code: "USD", locale: "en-US" });
  if (!ready) return <StepLoading />;
  return (
    <CurrencyLocaleStep
      initialValue={value}
      onChange={onChange}
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

/**
 * US-TAX-09 — pick the tax country first; a preset country gets its rates.
 * "Another country" goes on to the single default rate, as before (US-ONB-06).
 */
function TaxStepBody({
  onSaved,
  onSkip,
  onCountryChange,
  onRateChange,
  onCountrySaved,
}: {
  onSaved: () => void;
  onSkip: () => void;
  onCountryChange: (country: TaxCountry) => void;
  onRateChange: (rate: TaxRateValue) => void;
  onCountrySaved: () => void;
}) {
  const t = useT();
  const [country, setCountry] = useState<TaxCountry | null>(null);
  const [profile, setProfile] = useState<TaxProfile>({});
  const [phase, setPhase] = useState<"country" | "rate" | "gst">("country");

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiClient.get<TaxProfile>("/org/tax/profile"), apiClient.get<{ value: { code?: string } | null }>("/org/settings/currency")])
      .then(([saved, currency]) => {
        if (cancelled) return;
        setProfile(saved);
        const initial = saved.country ?? taxCountryForCurrency(currency.value?.code);
        setCountry(initial);
        onCountryChange(initial);
      })
      .catch(() => {
        if (!cancelled) setCountry("other");
      });
    return () => {
      cancelled = true;
    };
    // Loads once when the step opens; the callback only feeds the preview.
  }, []);

  if (phase === "gst") {
    // US-TAX-12 — India's GST registration comes next (US-TAX-09).
    return (
      <StepCard title={t("onboarding.page.gstTitle")} description={t("onboarding.page.gstDescription")}>
        <GstRegistrationForm
          initial={profile}
          onSaved={onSaved}
          saveLabel={t("onboarding.common.continue")}
          secondary={
            <Button type="button" variant="ghost" onClick={onSaved}>
              {t("onboarding.page.gstNotRegistered")}
            </Button>
          }
        />
      </StepCard>
    );
  }
  if (phase === "rate") {
    return (
      <StepCard title={t("onboarding.page.rateTitle")} description={t("onboarding.page.rateDescription")}>
        <DefaultTaxRateBody onSaved={onSaved} onSkip={onSkip} onChange={onRateChange} />
      </StepCard>
    );
  }
  return (
    <StepCard title={t("onboarding.page.taxTitle")} description={t("onboarding.page.taxDescription")}>
      {country === null ? (
        <StepLoading />
      ) : (
        <TaxCountryStep
          initialValue={country}
          onChange={onCountryChange}
          onSave={async (v) => {
            const res = await apiClient.put<{ profile: TaxProfile }>("/org/tax/profile", { country: v });
            setProfile(res.profile);
            onCountrySaved();
            if (v === "other") setPhase("rate");
            else if (v === "IN") setPhase("gst");
            else onSaved();
          }}
          onSkip={onSkip}
        />
      )}
    </StepCard>
  );
}

function DefaultTaxRateBody({ onSaved, onSkip, onChange }: { onSaved: () => void; onSkip: () => void; onChange: (value: TaxRateValue) => void }) {
  const t = useT();
  const [value, setValue] = useState<TaxRateValue>({ name: t("onboarding.page.defaultTaxName"), percentage: 0 });
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
      onChange={onChange}
      onSave={async (v) => {
        await apiClient.put("/org/tax/default-rate", v);
        onSaved();
      }}
      onSkip={onSkip}
    />
  );
}

function NumberingStepBody({ onSaved, onSkip, onChange }: { onSaved: () => void; onSkip: () => void; onChange: (rows: NumberingSequenceValue[]) => void }) {
  const [rows, setRows] = useState<NumberingSequenceValue[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<NumberingSequenceValue[]>("/org/numbering").then((res) => {
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
      onChange={onChange}
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
