"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { NumberingStep, type NumberingSequenceValue } from "../../onboarding/steps/numbering-step";
import { SavedToast } from "../saved-toast";

/**
 * S-10.5 — numbering prefixes and starting numbers, reused as-is from
 * onboarding. Relocated from the old routed `settings/numbering/page.tsx`
 * — content/logic unchanged.
 */
export function NumberingPane() {
  const [rows, setRows] = useState<NumberingSequenceValue[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ documentType: string; prefix: string; padding: number; nextValue: number }[]>("/org/numbering")
      .then((res) => {
        if (!cancelled) setRows(res);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document numbering</CardTitle>
        <CardDescription>Prefix and starting number for each document type.</CardDescription>
      </CardHeader>
      <CardContent>
        <NumberingStep
          initialValue={rows}
          saveLabel="Save"
          onSave={async (values) => {
            await Promise.all(
              values.map((row) =>
                apiClient.put(`/org/numbering/${row.documentType}`, {
                  prefix: row.prefix,
                  padding: row.padding,
                  nextValue: row.nextValue,
                }),
              ),
            );
            setRows(values);
            setSaved(true);
          }}
        />
      </CardContent>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </Card>
  );
}
