"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@spine/ui";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Document numbering</h2>
        <p className="text-[13px] text-on-surface-muted">Prefix and starting number for each document type.</p>
      </div>
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
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}
