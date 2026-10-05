"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { DEFAULT_THEME_PRESET, THEME_PRESETS, resolveThemePreset, type Branding, type ThemePreset } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { applyThemePreset } from "../../../components/org-theme-preset";
import type { BusinessProfileValue } from "../../onboarding/steps/business-profile-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/**
 * US-SET-09 — the organisation's app theme. Stored as
 * `branding.themePreset`; other branding fields are kept as they are. Each
 * swatch carries its own `data-brand`, so it shows that preset's primary
 * colour (in the viewer's light or dark mode) whatever theme is applied now.
 */
export function BrandingPane() {
  const branding = useSettingsValue<Branding>("branding", {});
  const profile = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
  const [preset, setPreset] = useState<ThemePreset>(DEFAULT_THEME_PRESET);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (branding.ready) setPreset(resolveThemePreset(branding.value.themePreset));
  }, [branding.ready, branding.value.themePreset]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Re-read so a branding change made since this pane opened isn't overwritten.
      const latest = await apiClient.get<{ value: Branding | null }>("/org/settings/branding");
      await apiClient.put("/org/settings/branding", { value: { ...(latest.value ?? {}), themePreset: preset } });
      applyThemePreset(preset);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the theme. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!branding.ready || !profile.ready) {
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
        <p className="text-[13px] text-on-surface-muted">Pick a theme for everyone in {business}. Your logo is set in Business profile.</p>
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

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" className="text-primary" onClick={() => setPreset(DEFAULT_THEME_PRESET)}>
          Reset to Spine defaults
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </form>
  );
}
