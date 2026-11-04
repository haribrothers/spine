"use client";

import { useEffect, useId, useState } from "react";
import { Button, Checkbox, DatePicker, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner } from "@spine/ui";
import { GST_STATES, gstinError, gstinStateCode, normaliseGstin, type ReturnPeriod, type TaxProfile } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * US-TAX-12 (D-146) — the business's GST registration: GSTIN (format,
 * check character and state), state, legal and trade name, registration
 * date and return period. Used by Settings › GST and the setup wizard.
 */
export function GstRegistrationForm({
  initial,
  onSaved,
  saveLabel = "Save",
  secondary,
}: {
  initial: TaxProfile;
  onSaved: (profile: TaxProfile) => void;
  saveLabel?: string;
  /** Rendered left of the save button (the wizard's "Skip to dashboard"). */
  secondary?: React.ReactNode;
}) {
  const [gstin, setGstin] = useState(typeof initial.registrationNumber === "string" ? initial.registrationNumber : "");
  const [stateCode, setStateCode] = useState(typeof initial.stateCode === "string" ? initial.stateCode : "");
  const [legalName, setLegalName] = useState(typeof initial.legalName === "string" ? initial.legalName : "");
  const [tradeName, setTradeName] = useState(typeof initial.tradeName === "string" ? initial.tradeName : "");
  const [registeredOn, setRegisteredOn] = useState<Date | undefined>(typeof initial.registeredOn === "string" ? new Date(`${initial.registeredOn}T00:00:00`) : undefined);
  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>(initial.returnPeriod ?? "monthly");
  // D-181 — exports under LUT are zero-rated with no IGST.
  const [exportUnderLut, setExportUnderLut] = useState(initial.exportUnderLut === true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registeredOnLabel = useId();

  const gstinMessage = gstin ? gstinError(gstin, stateCode || null) : touched ? "Enter your GSTIN." : null;
  const canSave = gstin !== "" && !gstinMessage && stateCode !== "" && legalName.trim() !== "";

  function changeGstin(value: string) {
    const next = normaliseGstin(value);
    setGstin(next);
    // The state follows the GSTIN's first two digits.
    const fromGstin = gstinStateCode(next);
    if (next.length >= 2 && fromGstin) setStateCode(fromGstin);
  }

  async function save() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.put<{ profile: TaxProfile }>("/org/tax/profile", {
        registrationNumber: gstin,
        stateCode,
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || null,
        registeredOn: registeredOn ? toIsoDate(registeredOn) : null,
        returnPeriod,
        exportUnderLut,
      });
      onSaved(res.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your GST details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="GSTIN" required errorText={gstinMessage ?? undefined}>
          {(field) => <Input {...field} value={gstin} maxLength={15} autoCapitalize="characters" onChange={(e) => changeGstin(e.target.value)} onBlur={() => setTouched(true)} />}
        </FormField>
        <FormField label="State" required>
          {(field) => (
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger {...field}>
                <SelectValue placeholder="Choose a state" />
              </SelectTrigger>
              <SelectContent>
                {GST_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Legal name" required errorText={touched && !legalName.trim() ? "Enter the legal name on your GST certificate." : undefined}>
          {(field) => <Input {...field} value={legalName} onChange={(e) => setLegalName(e.target.value)} />}
        </FormField>
        <FormField label="Trade name">{(field) => <Input {...field} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />}</FormField>
        <div className="flex flex-col gap-1.5" role="group" aria-labelledby={registeredOnLabel}>
          <span id={registeredOnLabel} className="text-[13px] font-medium text-on-surface">
            Registered on
          </span>
          <DatePicker value={registeredOn} onChange={setRegisteredOn} />
        </div>
        <FormField label="Return period">
          {(field) => (
            <Select value={returnPeriod} onValueChange={(v) => setReturnPeriod(v as ReturnPeriod)}>
              <SelectTrigger {...field}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <label htmlFor="gst-export-lut" className="flex cursor-pointer items-start gap-2">
        <Checkbox id="gst-export-lut" checked={exportUnderLut} onCheckedChange={(v) => setExportUnderLut(v === true)} className="mt-0.5" />
        <span className="flex flex-col">
          <span className="text-[13px] font-medium text-on-surface">We export under LUT</span>
          <span className="text-[12px] text-on-surface-muted">Exports go out zero-rated, with no IGST. Leave this off to charge IGST on exports.</span>
        </span>
      </label>
      <p className="text-[13px] text-on-surface-muted">Spine prepares GST invoices and a GSTR-1 file to upload. It never files your return or connects to the GST portal.</p>
      {error && <p className="text-[13px] text-overdue">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {secondary}
        <Button onClick={save} disabled={saving} className="ml-auto">
          {saving ? <Spinner size="sm" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** Settings › GST (US-TAX-12). */
export function GstPane() {
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then(setProfile)
      .catch(() => setProfile({}));
  }, []);

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">GST</h2>
        <p className="text-[13px] text-on-surface-muted">Your GST registration. Spine uses your state to pick intra- or inter-state tax.</p>
      </div>
      <GstRegistrationForm
        initial={profile}
        onSaved={(next) => {
          setProfile(next);
          setSaved(true);
        }}
      />
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
