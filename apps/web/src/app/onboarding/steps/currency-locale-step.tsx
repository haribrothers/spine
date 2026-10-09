"use client";

import { useState } from "react";
import { Button, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner } from "@spine/ui";

export interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const COMMON_LOCALES = ["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-NZ", "en-ZA"];

export interface CurrencyLocaleStepProps {
  initialValue: CurrencyLocaleValue;
  onSave: (value: CurrencyLocaleValue) => Promise<void>;
  onSkip?: () => void;
  /** Rendered on the save button — defaults to the wizard's "Continue"; Settings passes "Save". */
  saveLabel?: string;
  /** US-ONB-22 — the currency and locale picked so far, before they're saved, for the live preview. */
  onChange?: (value: CurrencyLocaleValue) => void;
}

/** S-12.4 (currency/locale half). Free-text fallback beneath the common-value pickers so nothing is a dead end for a currency/locale not in the short list. */
export function CurrencyLocaleStep({ initialValue, onSave, onSkip, saveLabel = "Continue", onChange }: CurrencyLocaleStepProps) {
  const [code, setCodeState] = useState(initialValue.code || "USD");
  const [locale, setLocaleState] = useState(initialValue.locale || "en-US");

  function setCode(next: string) {
    setCodeState(next);
    onChange?.({ code: next.toUpperCase(), locale });
  }

  function setLocale(next: string) {
    setLocaleState(next);
    onChange?.({ code: code.toUpperCase(), locale: next });
  }
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave({ code: code.toUpperCase(), locale });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Currency" helperText="ISO 4217 code, e.g. USD, EUR, INR.">
        {(field) => (
          <div className="flex gap-2">
            <Select value={COMMON_CURRENCIES.includes(code) ? code : undefined} onValueChange={setCode}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              {...field}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-24"
            />
          </div>
        )}
      </FormField>

      <FormField label="Locale" helperText="Controls date and number formatting.">
        {(field) => (
          <div className="flex gap-2">
            <Select value={COMMON_LOCALES.includes(locale) ? locale : undefined} onValueChange={setLocale}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input {...field} value={locale} onChange={(e) => setLocale(e.target.value)} className="w-32" />
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
