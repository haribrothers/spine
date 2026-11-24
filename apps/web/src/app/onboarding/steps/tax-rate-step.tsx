"use client";

import { useState } from "react";
import { Button, FormField, Input, Spinner } from "@spine/ui";
import { useT } from "../../../lib/i18n";

export interface TaxRateValue {
  name: string;
  percentage: number;
}

export interface TaxRateStepProps {
  initialValue: TaxRateValue;
  onSave: (value: TaxRateValue) => Promise<void>;
  onSkip?: () => void;
  /** Rendered on the save button — defaults to the wizard's "Continue"; Settings passes "Save". */
  saveLabel?: string;
  /** US-ONB-22 — the rate as typed so far, before it's saved, for the live preview. */
  onChange?: (value: TaxRateValue) => void;
}

/**
 * A single default named tax rate (S-12.5) — a deliberate quick-start step
 * so the first quote can price correctly. Full multi-rate tax-group CRUD /
 * inclusive-exclusive pricing (FEAT-08) is built and lives in Settings →
 * Tax (`settings/panes/tax-pane.tsx`), not here; this step intentionally
 * stays a single-rate shortcut, editable/expandable later from Settings.
 */
export function TaxRateStep({ initialValue, onSave, onSkip, saveLabel, onChange }: TaxRateStepProps) {
  const t = useT();
  const [name, setName] = useState(initialValue.name || t("onboarding.page.defaultTaxName"));
  const [percentage, setPercentage] = useState(String(initialValue.percentage ?? 0));
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave({ name, percentage: Number(percentage) || 0 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("onboarding.taxRate.name")} helperText={t("onboarding.taxRate.nameHelper")}>
        {(field) => (
          <Input
            {...field}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onChange?.({ name: e.target.value, percentage: Number(percentage) || 0 });
            }}
          />
        )}
      </FormField>

      <FormField label={t("onboarding.taxRate.rate")}>
        {(field) => (
          <Input
            {...field}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={percentage}
            onChange={(e) => {
              setPercentage(e.target.value);
              onChange?.({ name, percentage: Number(e.target.value) || 0 });
            }}
            className="w-32"
          />
        )}
      </FormField>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("onboarding.common.skipToDashboard")}
          </Button>
        )}
        <Button onClick={handleContinue} disabled={saving} className="ml-auto">
          {saving ? <Spinner size="sm" /> : (saveLabel ?? t("onboarding.common.continue"))}
        </Button>
      </div>
    </div>
  );
}
