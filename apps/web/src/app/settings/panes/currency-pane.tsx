"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { CurrencyLocaleStep, type CurrencyLocaleValue } from "../../onboarding/steps/currency-locale-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/** Relocated from the old routed `settings/currency/page.tsx` — content/logic unchanged. */
export function CurrencyPane() {
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
    <Card>
      <CardHeader>
        <CardTitle>Currency & locale</CardTitle>
        <CardDescription>Used for every document and report.</CardDescription>
      </CardHeader>
      <CardContent>
        <CurrencyLocaleStep
          initialValue={value}
          saveLabel="Save"
          onSave={async (v) => {
            await apiClient.put("/org/settings/currency", { value: v });
            setSaved(true);
          }}
        />
      </CardContent>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </Card>
  );
}
