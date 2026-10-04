"use client";

import { useState } from "react";
import { Spinner } from "@spine/ui";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Financial year</h2>
        <p className="text-[13px] text-on-surface-muted">The day your financial year starts, used for reports and closing periods. Document numbers never reset.</p>
      </div>
      <FinancialYearStep
        initialValue={value}
        saveLabel="Save"
        onSave={async (v) => {
          await apiClient.put("/org/settings/financial_year_start", { value: v });
          setSaved(true);
        }}
      />
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
