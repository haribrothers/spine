"use client";

import { useState } from "react";
import { Button, FormField, Input, Spinner } from "@spine/ui";

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
}

/**
 * A single default named tax rate (S-12.5). Full multi-rate tax-group CRUD
 * / inclusive-exclusive pricing is FEAT-08, explicitly out of scope here —
 * this step exists only so the first quote can price correctly.
 */
export function TaxRateStep({ initialValue, onSave, onSkip, saveLabel = "Continue" }: TaxRateStepProps) {
  const [name, setName] = useState(initialValue.name || "Tax");
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
      <FormField label="Tax name" helperText="e.g. VAT, GST, Sales Tax">
        {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>

      <FormField label="Rate (%)">
        {(field) => (
          <Input
            {...field}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            className="w-32"
          />
        )}
      </FormField>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip to dashboard
          </Button>
        )}
        <Button onClick={handleContinue} disabled={saving} className="ml-auto">
          {saving ? <Spinner size="sm" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}
