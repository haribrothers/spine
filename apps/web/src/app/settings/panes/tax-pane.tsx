"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { TaxRateStep, type TaxRateValue } from "../../onboarding/steps/tax-rate-step";
import { SavedToast } from "../saved-toast";

/**
 * S-10.1's tax half. TaxStepBody in onboarding/page.tsx reads/writes
 * `/org/tax/default-rate` directly (not `/org/settings/tax`) — mirrored
 * here exactly rather than going through useSettingsValue, which only
 * knows the generic `/org/settings/:key` shape.
 *
 * Relocated from the old routed `settings/tax/page.tsx` — content/logic unchanged.
 */
export function TaxPane() {
  const [value, setValue] = useState<TaxRateValue>({ name: "Tax", percentage: 0 });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<TaxRateValue>("/org/tax/default-rate")
      .then((res) => {
        if (!cancelled) setValue(res);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <CardTitle>Default tax rate</CardTitle>
        <CardDescription>Used to price a new quote or invoice line by default.</CardDescription>
      </CardHeader>
      <CardContent>
        <TaxRateStep
          initialValue={value}
          saveLabel="Save"
          onSave={async (v) => {
            await apiClient.put("/org/tax/default-rate", v);
            setValue(v);
            setSaved(true);
          }}
        />
      </CardContent>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </Card>
  );
}
