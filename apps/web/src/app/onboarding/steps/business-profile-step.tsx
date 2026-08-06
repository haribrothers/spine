"use client";

import { useState } from "react";
import { Alert, AlertDescription, Button, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { BusinessLogoUpload } from "./business-logo-upload";

export interface BusinessProfileValue {
  name: string;
  logoUrl?: string;
  address?: string;
  industry?: string;
}

export interface BusinessProfileStepProps {
  initialValue: BusinessProfileValue;
  onSave: (value: BusinessProfileValue) => Promise<void>;
  /** Rendered by the wizard shell only — lets this step stay reusable from Settings, which has no "skip". */
  onSkip?: () => void;
  saveLabel?: string;
}

/**
 * Business profile step (S-12.2) — name, logo, address, industry text.
 * Logo is a real upload via `BusinessLogoUpload` (pick → crop → `POST
 * /files`, the same plumbing Contacts' `ContactLogo` uses) — `logoUrl`
 * still just holds a URL string underneath (the `GET /files/:id` URL of
 * the uploaded file), so the `business_profile` settings shape is
 * unchanged from when it was a hand-typed URL field.
 */
export function BusinessProfileStep({ initialValue, onSave, onSkip, saveLabel = "Continue" }: BusinessProfileStepProps) {
  const [name, setName] = useState(initialValue.name ?? "");
  const [logoUrl, setLogoUrl] = useState(initialValue.logoUrl ?? "");
  const [address, setAddress] = useState(initialValue.address ?? "");
  const [industry, setIndustry] = useState(initialValue.industry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ name, logoUrl: logoUrl || undefined, address: address || undefined, industry: industry || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save business profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField label="Business name" required>
        {(field) => (
          <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="organization" />
        )}
      </FormField>

      <FormField label="Logo">
        {() => <BusinessLogoUpload logoUrl={logoUrl || undefined} onChange={(url) => setLogoUrl(url ?? "")} />}
      </FormField>

      <FormField label="Address">
        {(field) => <Textarea {...field} value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />}
      </FormField>

      <FormField label="Industry" helperText="Free text — the next step picks a template that pre-configures the app.">
        {(field) => (
          <Input {...field} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Electrical contracting" />
        )}
      </FormField>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip to dashboard
          </Button>
        )}
        <Button type="submit" disabled={saving || !name} className="ml-auto">
          {saving ? <Spinner size="sm" /> : saveLabel}
        </Button>
      </div>
    </form>
  );
}
