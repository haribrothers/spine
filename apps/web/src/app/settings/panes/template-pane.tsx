"use client";

import { useState } from "react";
import { Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { IndustryTemplateStep, type IndustryTemplate } from "../../onboarding/steps/industry-template-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";

/** Relocated from the old routed `settings/template/page.tsx` — content/logic unchanged. */
export function TemplatePane() {
  const { value, ready } = useSettingsValue<{ template: IndustryTemplate }>("industry_template", { template: "generic" });
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
        <h2 className="text-[15px] font-semibold text-on-surface">Industry template</h2>
        <p className="text-[13px] text-on-surface-muted">Pre-sets sensible defaults — you can change anything here at any time.</p>
      </div>
      <IndustryTemplateStep
        initialValue={value.template}
        saveLabel="Save"
        onSave={async (template) => {
          await apiClient.put("/org/settings/industry_template", { value: { template } });
          setSaved(true);
        }}
      />
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
