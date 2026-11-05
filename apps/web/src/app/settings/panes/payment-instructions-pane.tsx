"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, FormField, Input, Spinner, Switch, Textarea } from "@spine/ui";
import { PAYMENT_INSTRUCTIONS_MAX, PAYMENT_INSTRUCTIONS_TOO_LONG, UPI_ID_INVALID, UPI_ID_PATTERN } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import type { BusinessProfileValue } from "../../onboarding/steps/business-profile-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";
import { useT } from "../../../lib/i18n";

/**
 * US-INV-16 — "How customers can pay", printed under the totals on every
 * invoice issued from now on (US-INV-15) and in invoice emails. Stored as
 * `business_profile.paymentInstructions`; the rest of the profile is kept
 * as it is.
 *
 * US-INV-25 (D-150) — for an INR business, the UPI ID and payee name the
 * invoice's QR code pays (US-INV-26), and whether to show it.
 */
interface UpiFields {
  upiId?: string;
  upiPayeeName?: string;
  showUpiQr?: boolean;
}

export function PaymentInstructionsPane() {
  const t = useT();
  const { value, ready } = useSettingsValue<BusinessProfileValue & UpiFields>("business_profile", { name: "" });
  const { value: currency, ready: currencyReady } = useSettingsValue<{ code?: string }>("currency", {});
  const inr = currency.code === "INR";
  const [text, setText] = useState("");
  const [upiId, setUpiId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [showQr, setShowQr] = useState(true);
  const [upiError, setUpiError] = useState<string | undefined>();
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setText(value.paymentInstructions ?? "");
    setUpiId(value.upiId ?? "");
    setPayeeName(value.upiPayeeName ?? "");
    // On by default once a UPI ID is saved.
    setShowQr(value.showUpiQr ?? true);
  }, [ready, value.paymentInstructions, value.upiId, value.upiPayeeName, value.showUpiQr]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.length > PAYMENT_INSTRUCTIONS_MAX) {
      setFieldError(PAYMENT_INSTRUCTIONS_TOO_LONG);
      return;
    }
    setFieldError(undefined);
    const upi = upiId.trim();
    if (inr && upi && !UPI_ID_PATTERN.test(upi)) {
      setUpiError(UPI_ID_INVALID);
      return;
    }
    setUpiError(undefined);
    setSaving(true);
    try {
      // Re-read so a profile change made since this pane opened isn't overwritten.
      const latest = await apiClient.get<{ value: BusinessProfileValue | null }>("/org/settings/business_profile");
      const trimmed = text.trim();
      await apiClient.put("/org/settings/business_profile", {
        value: {
          ...(latest.value ?? { name: "" }),
          paymentInstructions: trimmed || undefined,
          ...(inr ? { upiId: upi || undefined, upiPayeeName: payeeName.trim() || undefined, showUpiQr: upi ? showQr : undefined } : {}),
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.paymentInstructions.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !currencyReady) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSave} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.paymentInstructions.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{t("settings.paymentInstructions.description")}</p>
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField label={t("settings.paymentInstructions.howToPay")} helperText={t("settings.paymentInstructions.howToPayHelp")} errorText={fieldError}>
        {(field) => (
          <Textarea
            {...field}
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (fieldError && e.target.value.length <= PAYMENT_INSTRUCTIONS_MAX) setFieldError(undefined);
            }}
          />
        )}
      </FormField>
      {inr && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">{t("settings.paymentInstructions.upiHeading")}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label={t("settings.paymentInstructions.upiId")} errorText={upiError}>
              {(field) => (
                <Input
                  {...field}
                  value={upiId}
                  placeholder={t("settings.paymentInstructions.upiIdPlaceholder")}
                  autoCapitalize="none"
                  onChange={(e) => {
                    setUpiId(e.target.value);
                    if (upiError) setUpiError(undefined);
                  }}
                />
              )}
            </FormField>
            <FormField label={t("settings.paymentInstructions.payeeName")}>{(field) => <Input {...field} value={payeeName} placeholder={value.name || t("settings.paymentInstructions.payeeNamePlaceholder")} onChange={(e) => setPayeeName(e.target.value)} />}</FormField>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border-strong bg-surface p-3">
            <div>
              <p id="upi-qr-label" className="text-[14px] font-medium text-on-surface">
                {t("settings.paymentInstructions.showQr")}
              </p>
              <p className="text-[13px] text-on-surface-muted">{t("settings.paymentInstructions.showQrHelp")}</p>
            </div>
            <Switch aria-labelledby="upi-qr-label" checked={showQr && upiId.trim() !== ""} disabled={upiId.trim() === ""} onCheckedChange={setShowQr} />
          </div>
        </div>
      )}
      <p className="text-[13px] text-on-surface-muted">
        {inr ? t("settings.paymentInstructions.keepNoteInr") : t("settings.paymentInstructions.keepNote")}
      </p>
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </form>
  );
}
