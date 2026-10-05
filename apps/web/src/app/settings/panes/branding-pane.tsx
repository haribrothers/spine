"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, FormField, Input, RadioGroup, RadioGroupItem, Spinner, Textarea, cn } from "@spine/ui";
import {
  DEFAULT_DOCUMENT_COLOR,
  DEFAULT_THEME_PRESET,
  DOCUMENT_COLOR_FORMAT,
  DOCUMENT_COLOR_MIN_CONTRAST,
  DOCUMENT_FOOTER_MAX,
  DOCUMENT_FOOTER_TOO_LONG,
  THEME_PRESETS,
  contrastOnWhite,
  documentColorTooLight,
  formatContrast,
  isHexColor,
  resolveThemePreset,
  type Branding,
  type ThemePreset,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { applyThemePreset } from "../../../components/org-theme-preset";
import type { BusinessProfileValue } from "../../onboarding/steps/business-profile-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/** A sample total for the preview: 2,185.00 in the organisation's currency. */
const PREVIEW_TOTAL = 218_500n;

/**
 * US-SET-09 / US-SET-10 — the organisation's app theme, and the colour and
 * footer its quotes, invoices, credit notes, receipts and emails use.
 * Stored in the `branding` setting; fields this pane doesn't show are kept.
 * Each theme swatch carries its own `data-brand`, so it shows that preset's
 * primary colour whatever theme is applied now; the document preview stays
 * light (`data-surface="document"`) like the PDFs it stands for.
 */
export function BrandingPane() {
  const branding = useSettingsValue<Branding>("branding", {});
  const profile = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
  const currency = useSettingsValue<{ code?: string }>("currency", { code: "USD" });
  const [preset, setPreset] = useState<ThemePreset>(DEFAULT_THEME_PRESET);
  const [color, setColor] = useState(DEFAULT_DOCUMENT_COLOR);
  const [footer, setFooter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!branding.ready) return;
    setPreset(resolveThemePreset(branding.value.themePreset));
    setColor(typeof branding.value.documentColor === "string" ? branding.value.documentColor : DEFAULT_DOCUMENT_COLOR);
    setFooter(typeof branding.value.documentFooter === "string" ? branding.value.documentFooter : "");
  }, [branding.ready, branding.value]);

  const colorIsHex = isHexColor(color);
  const ratio = colorIsHex ? contrastOnWhite(color) : 0;
  const colorError = !colorIsHex ? DOCUMENT_COLOR_FORMAT : ratio < DOCUMENT_COLOR_MIN_CONTRAST ? documentColorTooLight(ratio) : undefined;
  const footerError = footer.length > DOCUMENT_FOOTER_MAX ? DOCUMENT_FOOTER_TOO_LONG : undefined;
  const previewColor = colorError ? DEFAULT_DOCUMENT_COLOR : color;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (colorError || footerError) return;
    setSaving(true);
    try {
      // Re-read so a branding change made since this pane opened isn't overwritten.
      const latest = await apiClient.get<{ value: Branding | null }>("/org/settings/branding");
      const trimmed = footer.trim();
      await apiClient.put("/org/settings/branding", {
        value: { ...(latest.value ?? {}), themePreset: preset, documentColor: color.toUpperCase(), documentFooter: trimmed || undefined },
      });
      applyThemePreset(preset);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the branding. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!branding.ready || !profile.ready || !currency.ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const business = profile.value.name?.trim() || "your organisation";

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSave} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Branding</h2>
        <p className="text-[13px] text-on-surface-muted">
          Pick a theme for everyone in {business} and the colour your quotes, invoices and receipts use. Your logo is set in Business profile.
        </p>
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium text-on-surface">App theme</legend>
        <RadioGroup value={preset} onValueChange={(v) => setPreset(v as ThemePreset)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_PRESETS.map((option) => (
            <label
              key={option.id}
              htmlFor={`theme-${option.id}`}
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-lg bg-surface p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface",
                preset === option.id ? "border border-primary ring-1 ring-primary" : "border border-border hover:border-border-strong",
              )}
            >
              <span className="sr-only">
                <RadioGroupItem value={option.id} id={`theme-${option.id}`} />
              </span>
              <span data-brand={option.id} aria-hidden="true" className="h-10 w-full rounded-md bg-primary" />
              <span className="flex flex-col">
                <span className="text-[14px] font-medium text-on-surface">{option.label}</span>
                <span className="text-[12px] text-on-surface-muted">{option.id === DEFAULT_THEME_PRESET ? "Default" : "Preset"}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <p className="text-[13px] text-on-surface-muted">Each person still chooses light or dark mode in their own Profile &amp; Preferences.</p>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <FormField label="Document colour" errorText={colorError}>
            {(field) => (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick the document colour"
                  value={previewColor}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-0.5"
                />
                <Input {...field} className="font-mono" value={color} maxLength={7} onChange={(e) => setColor(e.target.value.trim())} />
              </div>
            )}
          </FormField>
          {!colorError && <p className="-mt-1 text-[13px] text-paid">✓ Readable on white ({formatContrast(ratio)}, passes AA)</p>}
          <FormField
            label="Document footer"
            helperText="On every quote, invoice, credit note and receipt, and in emails. Up to 300 characters."
            errorText={footerError}
          >
            {(field) => <Textarea {...field} rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} />}
          </FormField>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-3">
          <span className="text-[13px] font-medium text-on-surface-muted" id="branding-preview-label">
            Preview
          </span>
          <div
            data-surface="document"
            role="img"
            aria-labelledby="branding-preview-label"
            className="flex flex-col gap-2 overflow-hidden rounded-md border border-border bg-surface px-3 pb-3 shadow-sm"
          >
            <span className="-mx-3 h-1" style={{ backgroundColor: previewColor }} />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[13px] font-semibold text-on-surface">{business === "your organisation" ? "Your business" : business}</span>
              <span className="text-[12px] font-bold" style={{ color: previewColor }}>
                INVOICE
              </span>
            </div>
            <span className="h-1.5 w-3/4 rounded-full bg-border" />
            <span className="h-1.5 w-1/2 rounded-full bg-border" />
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="text-[12px] font-semibold text-on-surface">Total</span>
              <span className="text-[12px] font-semibold" style={{ color: previewColor }}>
                {formatMoney(PREVIEW_TOTAL, currency.value.code ?? "USD")}
              </span>
            </div>
            {footer.trim() && <p className="text-[11px] leading-snug text-on-surface-muted">{footer.trim()}</p>}
          </div>
          <p className="text-[12px] text-on-surface-muted">Issued documents keep the colour and footer they were issued with.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          className="text-primary"
          onClick={() => {
            setPreset(DEFAULT_THEME_PRESET);
            setColor(DEFAULT_DOCUMENT_COLOR);
          }}
        >
          Reset to Spine defaults
        </Button>
        <Button type="submit" disabled={saving || !!colorError || !!footerError}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </form>
  );
}
