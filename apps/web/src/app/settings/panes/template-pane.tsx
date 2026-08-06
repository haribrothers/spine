"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
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
    <Card>
      <CardHeader>
        <CardTitle>Industry template</CardTitle>
        <CardDescription>Pre-sets sensible defaults — you can change anything here at any time.</CardDescription>
      </CardHeader>
      <CardContent>
        <IndustryTemplateStep
          initialValue={value.template}
          onSave={async (template) => {
            await apiClient.put("/org/settings/industry_template", { value: { template } });
            setSaved(true);
          }}
        />
      </CardContent>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </Card>
  );
}
