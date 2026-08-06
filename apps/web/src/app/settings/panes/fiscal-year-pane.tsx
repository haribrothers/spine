"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { FinancialYearStep, type FinancialYearValue } from "../../onboarding/steps/financial-year-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/** Relocated from the old routed `settings/fiscal-year/page.tsx` — content/logic unchanged. */
export function FiscalYearPane() {
  const { value, ready } = useSettingsValue<FinancialYearValue>("financial_year_start", { month: 1, day: 1 });
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
        <CardTitle>Financial year</CardTitle>
        <CardDescription>Number sequences reset annually on this date by default.</CardDescription>
      </CardHeader>
      <CardContent>
        <FinancialYearStep
          initialValue={value}
          saveLabel="Save"
          onSave={async (v) => {
            await apiClient.put("/org/settings/financial_year_start", { value: v });
            setSaved(true);
          }}
        />
      </CardContent>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </Card>
  );
}
