"use client";

import { useEffect, useState } from "react";
import { FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { GST_STATES, GST_TREATMENTS, GST_TREATMENT_LABELS, gstinError, gstinRequired, gstinStateCode, normaliseGstin, type GstTreatment, type TaxProfile } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t as translate, useT } from "../../../lib/i18n";

/** US-TAX-12 — the organisation's tax country, for showing GST fields only in India. */
export function useTaxCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then((p) => setCountry(p.country ?? "other"))
      .catch(() => setCountry("other"));
  }, []);
  return country;
}

/** What's wrong with a contact's GST details, or null. */
export function contactGstError(treatment: GstTreatment | null, gstin: string, stateCode?: string | null): string | null {
  if (!gstinRequired(treatment)) return null;
  if (!gstin.trim()) return translate("contacts.gst.gstinMissing");
  return gstinError(gstin, stateCode);
}

/**
 * US-TAX-12 (D-146) — a contact's GST treatment and GSTIN (stored in
 * `taxId`). The GSTIN is required for a registered business or SEZ unit,
 * and its state is shown from its first two digits.
 */
export function ContactGstFields({
  treatment,
  gstin,
  stateCode,
  onTreatmentChange,
  onGstinChange,
  onStateCodeChange,
  showErrors,
}: {
  treatment: GstTreatment | null;
  gstin: string;
  stateCode: string | null;
  onTreatmentChange: (value: GstTreatment) => void;
  onGstinChange: (value: string) => void;
  onStateCodeChange: (value: string) => void;
  showErrors: boolean;
}) {
  const t = useT();
  const fromGstin = gstinStateCode(gstin);
  const error = contactGstError(treatment, gstin, stateCode);

  function changeGstin(value: string) {
    const next = treatment === "overseas" ? value : normaliseGstin(value);
    onGstinChange(next);
    // A blank state (or one the old GSTIN set) follows the GSTIN.
    const nextState = treatment === "overseas" ? null : gstinStateCode(next);
    if (nextState && (!stateCode || stateCode === fromGstin)) onStateCodeChange(nextState);
  }
  return (
    <>
      <FormField label={t("contacts.gst.treatment")} helperText={t("contacts.gst.treatmentHelper")}>
        {(field) => (
          <Select value={treatment ?? ""} onValueChange={(v) => onTreatmentChange(v as GstTreatment)}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue placeholder={t("contacts.gst.treatmentPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {GST_TREATMENTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {GST_TREATMENT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          label={treatment === "overseas" ? t("contacts.gst.taxId") : t("contacts.gst.gstin")}
          required={gstinRequired(treatment)}
          errorText={showErrors || (gstin.length === 15 && error) ? (error ?? undefined) : undefined}
          helperText={fromGstin && stateCode === fromGstin ? t("contacts.gst.stateFromGstin") : undefined}
        >
          {(field) => (
            <Input
              {...field}
              // Our message says what to do; the browser's own bubble wouldn't.
              required={false}
              value={gstin}
              maxLength={treatment === "overseas" ? undefined : 15}
              onChange={(e) => changeGstin(e.target.value)}
            />
          )}
        </FormField>
        {treatment !== "overseas" && (
          <FormField label={t("contacts.gst.state")}>
            {(field) => (
              <Select value={stateCode ?? ""} onValueChange={onStateCodeChange}>
                <SelectTrigger {...field} className="w-full">
                  <SelectValue placeholder={t("contacts.common.choosePlaceholderState")} />
                </SelectTrigger>
                <SelectContent>
                  {GST_STATES.map((st) => (
                    <SelectItem key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}
      </div>
      <p className="text-[13px] text-on-surface-muted">{t("contacts.gst.addressNote")}</p>
    </>
  );
}
