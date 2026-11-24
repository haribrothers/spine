"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";

/**
 * Same hook as apps/web/src/app/onboarding/page.tsx's local
 * `useSettingsValue` — pulled out here so Settings' section pages don't
 * duplicate it, and so onboarding and Settings stay reading/writing the
 * exact same `/org/settings/:key` endpoints. Onboarding's copy is left
 * as-is (not imported from here) since page.tsx is a single self-contained
 * file by design and this task's brief scopes changes to Settings.
 */
export function useSettingsValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ key: string; value: T | null }>(`/org/settings/${key}`)
      .then((res) => {
        if (!cancelled && res.value !== null) {
          setValue(res.value);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { value, ready };
}
