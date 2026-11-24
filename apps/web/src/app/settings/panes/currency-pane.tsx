"use client";

import { useState } from "react";
import { Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { CurrencyLocaleStep, type CurrencyLocaleValue } from "../../onboarding/steps/currency-locale-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";
import { useT } from "../../../lib/i18n";

/** Relocated from the old routed `settings/currency/page.tsx` — content/logic unchanged. */
export function CurrencyPane() {
  const t = useT();
  const { value, ready } = useSettingsValue<CurrencyLocaleValue>("currency", { code: "USD", locale: "en-US" });
  const [saved, setSaved] = useState(false);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.currency.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{t("settings.currency.description")}</p>
      </div>
      <CurrencyLocaleStep
        initialValue={value}
        saveLabel={t("settings.common.save")}
        onSave={async (v) => {
          await apiClient.put("/org/settings/currency", { value: v });
          setSaved(true);
        }}
      />
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
