"use client";

import { useState } from "react";
import { Button, FormField, Input, Spinner } from "@spine/ui";
import { t as translate, useT } from "../../../lib/i18n";

export interface NumberingSequenceValue {
  documentType: string;
  prefix: string;
  padding: number;
  nextValue: number;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  quote: translate("onboarding.numbering.types.quote"),
  invoice: translate("onboarding.numbering.types.invoice"),
  credit_note: translate("onboarding.numbering.types.creditNote"),
  receipt: translate("onboarding.numbering.types.receipt"),
  expense: translate("onboarding.numbering.types.expense"),
  job: translate("onboarding.numbering.types.job"),
  vendor_payment: translate("onboarding.numbering.types.vendorPayment"),
  vendor_credit: translate("onboarding.numbering.types.vendorCredit"),
  journal: translate("onboarding.numbering.types.journal"),
};

export interface NumberingStepProps {
  initialValue: NumberingSequenceValue[];
  onSave: (value: NumberingSequenceValue[]) => Promise<void>;
  onSkip?: () => void;
  /** Rendered on the save button — defaults to the wizard's "Continue"; Settings passes "Save". */
  saveLabel?: string;
  /** US-ONB-22 — the rows as edited so far, before they're saved, for the live preview. */
  onChange?: (value: NumberingSequenceValue[]) => void;
}

/** S-10.5 / numbering step of the wizard — prefix + padding + starting number per document type, per §14.3's canonical list. */
export function NumberingStep({ initialValue, onSave, onSkip, saveLabel, onChange }: NumberingStepProps) {
  const t = useT();
  const [rows, setRows] = useState<NumberingSequenceValue[]>(initialValue);
  const [saving, setSaving] = useState(false);

  function updateRow(documentType: string, patch: Partial<NumberingSequenceValue>) {
    const next = rows.map((row) => (row.documentType === documentType ? { ...row, ...patch } : row));
    setRows(next);
    onChange?.(next);
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await onSave(rows);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border border-border-strong bg-surface">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead>
            <tr className="border-b border-border-strong bg-surface-muted text-left text-on-surface-muted">
              <th className="px-3 py-2 font-medium">{t("onboarding.numbering.document")}</th>
              <th className="px-3 py-2 font-medium">{t("onboarding.numbering.prefix")}</th>
              <th className="px-3 py-2 font-medium">{t("onboarding.numbering.padding")}</th>
              <th className="px-3 py-2 font-medium">{t("onboarding.numbering.startingNumber")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.documentType} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-on-surface">{DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType}</td>
                <td className="px-3 py-2">
                  <FormField label="" className="gap-0">
                    {(field) => (
                      <Input
                        {...field}
                        aria-label={t("onboarding.numbering.prefixLabel", { type: DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType })}
                        value={row.prefix}
                        onChange={(e) => updateRow(row.documentType, { prefix: e.target.value.toUpperCase() })}
                        className="w-24"
                      />
                    )}
                  </FormField>
                </td>
                <td className="px-3 py-2">
                  <FormField label="" className="gap-0">
                    {(field) => (
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={8}
                        aria-label={t("onboarding.numbering.paddingLabel", { type: DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType })}
                        value={row.padding}
                        onChange={(e) => updateRow(row.documentType, { padding: Number(e.target.value) || 1 })}
                        className="w-20"
                      />
                    )}
                  </FormField>
                </td>
                <td className="px-3 py-2">
                  <FormField label="" className="gap-0">
                    {(field) => (
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        aria-label={t("onboarding.numbering.startingNumberLabel", { type: DOCUMENT_TYPE_LABELS[row.documentType] ?? row.documentType })}
                        value={row.nextValue}
                        onChange={(e) => updateRow(row.documentType, { nextValue: Number(e.target.value) || 1 })}
                        className="w-24"
                      />
                    )}
                  </FormField>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
