"use client";

import { useState } from "react";
import { Button, RadioGroup, RadioGroupItem, Spinner, cn } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";
import { t, useT } from "../../../lib/i18n";

export type QuoteConversionGuardMode = "off" | "warn" | "block";

const MODES: { value: QuoteConversionGuardMode; title: string; description: string }[] = [
  {
    value: "warn",
    title: t("settings.quoteConversionGuard.warn.title"),
    description: t("settings.quoteConversionGuard.warn.description"),
  },
  {
    value: "block",
    title: t("settings.quoteConversionGuard.block.title"),
    description: t("settings.quoteConversionGuard.block.description"),
  },
  {
    value: "off",
    title: t("settings.quoteConversionGuard.off.title"),
    description: t("settings.quoteConversionGuard.off.description"),
  },
];

/**
 * Org preference backing `QuoteConversionGuardService` (apps/api/src/modules/org)
 * — governs what happens when "Convert to job" / "Convert to invoice" is
 * used on a quote that's already been converted before. Neither action has
 * ever had a hard one-shot restriction (a deliberate second conversion is a
 * real use case — staged billing, splitting one quote across two jobs), so
 * this is a warn/block CHOICE, not a fixed rule, matching the org's own
 * tolerance for how often that happens by accident versus on purpose.
 */
export function QuoteConversionGuardPane() {
  const { value, ready } = useSettingsValue<{ mode: QuoteConversionGuardMode }>("quote_conversion_guard", { mode: "warn" });

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return <QuoteConversionGuardForm initialMode={value.mode} />;
}

/**
 * Split from the pane above so `useState(initialMode)` only ever
 * initializes once, at mount — this only mounts once `ready` is true, per
 * IndustryTemplateStep's exact same "step component mounted after data
 * loads" convention.
 */
function QuoteConversionGuardForm({ initialMode }: { initialMode: QuoteConversionGuardMode }) {
  const t = useT();
  const [mode, setMode] = useState<QuoteConversionGuardMode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put("/org/settings/quote_conversion_guard", { value: { mode } });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.quoteConversionGuard.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">
          {t("settings.quoteConversionGuard.description")}
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as QuoteConversionGuardMode)} className="gap-3">
        {MODES.map((m) => (
          <label
            key={m.value}
            htmlFor={`conversion-guard-${m.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              mode === m.value ? "border-primary bg-primary/5" : "border-border-strong",
            )}
          >
            <RadioGroupItem value={m.value} id={`conversion-guard-${m.value}`} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-on-surface">{m.title}</p>
              <p className="text-[13px] text-on-surface-muted">{m.description}</p>
            </div>
          </label>
        ))}
      </RadioGroup>

      <Button onClick={handleSave} disabled={saving} className="ml-auto">
        {saving ? <Spinner size="sm" /> : t("settings.common.save")}
      </Button>

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
