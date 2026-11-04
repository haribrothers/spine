"use client";

import { useState } from "react";
import { Button, FormField, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner } from "@spine/ui";

export interface FinancialYearValue {
  month: number;
  day: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface FinancialYearStepProps {
  initialValue: FinancialYearValue;
  onSave: (value: FinancialYearValue) => Promise<void>;
  onSkip?: () => void;
  /** Rendered on the save button — defaults to the wizard's "Continue"; Settings passes "Save". */
  saveLabel?: string;
}

/** S-12.4 (financial year half). Month + day-of-month picker — used for reports and period close; document numbers never reset (D-077). */
export function FinancialYearStep({ initialValue, onSave, onSkip, saveLabel = "Continue" }: FinancialYearStepProps) {
  const [month, setMonth] = useState(initialValue.month || 1);
  const [day, setDay] = useState(initialValue.day || 1);
  const [saving, setSaving] = useState(false);

  const daysInMonth = new Date(2027, month, 0).getDate();

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave({ month, day: Math.min(day, daysInMonth) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Financial year starts on">
        {() => (
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger className="w-24" aria-label="Day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
