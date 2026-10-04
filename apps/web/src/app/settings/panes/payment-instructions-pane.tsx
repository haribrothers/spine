"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, FormField, Spinner, Textarea } from "@spine/ui";
import { PAYMENT_INSTRUCTIONS_MAX, PAYMENT_INSTRUCTIONS_TOO_LONG } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import type { BusinessProfileValue } from "../../onboarding/steps/business-profile-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/**
 * US-INV-16 — "How customers can pay", printed under the totals on every
 * invoice issued from now on (US-INV-15) and in invoice emails. Stored as
 * `business_profile.paymentInstructions`; the rest of the profile is kept
 * as it is.
 */
export function PaymentInstructionsPane() {
  const { value, ready } = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ready) setText(value.paymentInstructions ?? "");
  }, [ready, value.paymentInstructions]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.length > PAYMENT_INSTRUCTIONS_MAX) {
      setFieldError(PAYMENT_INSTRUCTIONS_TOO_LONG);
      return;
    }
    setFieldError(undefined);
    setSaving(true);
    try {
      // Re-read so a profile change made since this pane opened isn't overwritten.
      const latest = await apiClient.get<{ value: BusinessProfileValue | null }>("/org/settings/business_profile");
      const trimmed = text.trim();
      await apiClient.put("/org/settings/business_profile", {
        value: { ...(latest.value ?? { name: "" }), paymentInstructions: trimmed || undefined },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the payment instructions. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSave} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Payment instructions</h2>
        <p className="text-[13px] text-on-surface-muted">Printed under the totals on every invoice and in invoice emails, so customers know how to pay.</p>
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField label="How customers can pay" helperText="Up to 600 characters. Leave empty to hide the block." errorText={fieldError}>
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
      <p className="text-[13px] text-on-surface-muted">
        Issued invoices keep the instructions they were issued with — changing this only affects invoices issued from now on.
      </p>
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </form>
  );
}
