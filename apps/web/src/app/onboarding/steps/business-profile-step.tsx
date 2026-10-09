"use client";

import { useState } from "react";
import { Alert, AlertDescription, Button, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { BusinessLogoUpload } from "./business-logo-upload";

export interface BusinessProfileValue {
  name: string;
  logoUrl?: string;
  address?: string;
  /** US-QUO-21 — shown to customers whose quote link has expired, so they can get in touch. */
  email?: string;
  phone?: string;
  industry?: string;
  /** Kept as-is: set from Settings › Payment instructions (US-INV-16). */
  paymentInstructions?: string;
}

export interface BusinessProfileStepProps {
  initialValue: BusinessProfileValue;
  onSave: (value: BusinessProfileValue) => Promise<void>;
  /** Rendered by the wizard shell only — lets this step stay reusable from Settings, which has no "skip". */
  onSkip?: () => void;
  saveLabel?: string;
  /** US-ONB-22 — what's typed so far, before it's saved, for the wizard's live preview. */
  onChange?: (value: Pick<BusinessProfileValue, "name" | "logoUrl" | "address">) => void;
}

/**
 * Business profile step (S-12.2) — name, logo, address, industry text.
 * Logo is a real upload via `BusinessLogoUpload` (pick → crop → `POST
 * /files`, the same plumbing Contacts' `ContactLogo` uses) — `logoUrl`
 * still just holds a URL string underneath (the `GET /files/:id` URL of
 * the uploaded file), so the `business_profile` settings shape is
 * unchanged from when it was a hand-typed URL field.
 */
export function BusinessProfileStep({ initialValue, onSave, onSkip, saveLabel = "Continue", onChange }: BusinessProfileStepProps) {
  const [name, setName] = useState(initialValue.name ?? "");
  const [logoUrl, setLogoUrl] = useState(initialValue.logoUrl ?? "");
  const [address, setAddress] = useState(initialValue.address ?? "");
  const [email, setEmail] = useState(initialValue.email ?? "");
  const [phone, setPhone] = useState(initialValue.phone ?? "");
  const [industry, setIndustry] = useState(initialValue.industry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function emit(patch: { name?: string; logoUrl?: string; address?: string }) {
    const next = { name, logoUrl, address, ...patch };
    onChange?.({ name: next.name, logoUrl: next.logoUrl || undefined, address: next.address || undefined });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Spread first so fields edited elsewhere (payment instructions) survive.
      await onSave({
        ...initialValue,
        name,
        logoUrl: logoUrl || undefined,
        address: address || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        industry: industry || undefined,
      });
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
          <Input
            {...field}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              emit({ name: e.target.value });
            }}
            required
            autoComplete="organization"
          />
        )}
      </FormField>

      <FormField label="Logo">
        {() => <BusinessLogoUpload logoUrl={logoUrl || undefined} onChange={(url) => {
              setLogoUrl(url ?? "");
              emit({ logoUrl: url ?? "" });
            }} />}
      </FormField>

      <FormField label="Address">
        {(field) => (
          <Textarea
            {...field}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              emit({ address: e.target.value });
            }}
            rows={3}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Business email" helperText="Shown to customers who need to reach you.">
          {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
        </FormField>
        <FormField label="Business phone">
          {(field) => <Input {...field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}
        </FormField>
      </div>

      {/* US-OPS-21: "the next step" only means something in the wizard. */}
      <FormField
        label="Industry"
        helperText={onSkip ? "Free text — the next step picks a template that pre-configures the app." : "What your business does, in your own words."}
      >
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
