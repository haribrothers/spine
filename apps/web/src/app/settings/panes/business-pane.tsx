"use client";

import { useState } from "react";
import { Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { BusinessProfileStep, type BusinessProfileValue } from "../../onboarding/steps/business-profile-step";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";
import { useT } from "../../../lib/i18n";

/**
 * S-10.1 — business profile, editable independent of onboarding. Mounts the
 * exact same BusinessProfileStep the wizard uses, reading/writing the same
 * `/org/settings/business_profile` key. No `onSkip` is passed (Settings has
 * no "skip to dashboard" concept), and `saveLabel="Save"` replaces the
 * wizard's default "Continue" — both already supported by the component's
 * existing optional props, so no prop-shape changes were needed.
 *
 * Relocated from the old routed `apps/web/src/app/settings/business/page.tsx`
 * into a pane hosted by SettingsDialog — content/logic unchanged.
 */
export function BusinessPane() {
  const t = useT();
  const { value, ready } = useSettingsValue<BusinessProfileValue>("business_profile", { name: "" });
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
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.business.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{t("settings.business.description")}</p>
      </div>
      <BusinessProfileStep
        initialValue={value}
        saveLabel={t("settings.common.save")}
        onSave={async (v) => {
          await apiClient.put("/org/settings/business_profile", { value: v });
          setSaved(true);
        }}
      />
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
