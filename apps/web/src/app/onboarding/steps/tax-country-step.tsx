"use client";

import { useState } from "react";
import { Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { OTHER_COUNTRY_LABEL, TAX_PRESETS, type TaxCountry } from "@spine/shared";
import { useT } from "../../../lib/i18n";

const CHOICES: { value: TaxCountry; title: string; description?: string }[] = [
  ...TAX_PRESETS.map((p) => ({ value: p.country, title: p.label, description: p.description })),
  { value: "other", title: OTHER_COUNTRY_LABEL },
];

/** A sensible first choice from the currency picked a step earlier. */
const COUNTRY_BY_CURRENCY: Record<string, TaxCountry> = { INR: "IN", GBP: "GB", AUD: "AU", NZD: "NZ", AED: "AE", SAR: "SA" };

export function taxCountryForCurrency(currency: string | undefined): TaxCountry {
  return (currency && COUNTRY_BY_CURRENCY[currency]) || "other";
}

export interface TaxCountryStepProps {
  initialValue: TaxCountry;
  onSave: (value: TaxCountry) => Promise<void>;
  onSkip?: () => void;
  /** US-ONB-22 — the country picked so far, before it's saved, for the live preview. */
  onChange?: (value: TaxCountry) => void;
}

/**
 * US-TAX-09 (D-145) — "Where is your business registered for tax?" A
 * country with a preset gets its rates; "Another country" goes on to the
 * single-rate step as before (US-ONB-06).
 */
export function TaxCountryStep({ initialValue, onSave, onSkip, onChange }: TaxCountryStepProps) {
  const t = useT();
  const [value, setValue] = useState<TaxCountry>(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup value={value} onValueChange={(v) => {
          setValue(v as TaxCountry);
          onChange?.(v as TaxCountry);
        }} className="gap-3" aria-label={t("onboarding.taxCountry.label")}>
        {CHOICES.map((choice) => (
          <label
            key={choice.value}
            htmlFor={`tax-country-${choice.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              value === choice.value ? "border-primary bg-primary/5" : "border-border-strong",
            )}
          >
            <RadioGroupItem value={choice.value} id={`tax-country-${choice.value}`} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-on-surface">{choice.title}</p>
              {choice.description && <p className="text-[13px] text-on-surface-muted">{choice.description}</p>}
            </div>
          </label>
        ))}
      </RadioGroup>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("onboarding.common.skipToDashboard")}
          </Button>
        )}
        <Button onClick={handleContinue} disabled={saving} className="ml-auto">
          {saving ? <Spinner size="sm" /> : t("onboarding.common.continue")}
        </Button>
      </div>
    </div>
  );
}
