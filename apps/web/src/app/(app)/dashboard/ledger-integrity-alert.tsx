"use client";

import { useEffect, useState } from "react";
import { Alert } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";

/**
 * US-RPT-12 — the Owners' warning when the daily check finds the books out
 * of balance. Nothing shows while they balance, before the first check, or
 * if the check can't be read; it disappears once a later check passes.
 */
export function LedgerIntegrityAlert() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ message: string | null }>("/reports/ledger-integrity")
      .then((res) => setMessage(res.message))
      .catch(() => setMessage(null));
  }, []);

  if (!message) return null;
  return (
    <Alert variant="critical" data-testid="ledger-integrity-alert">
      {message}
    </Alert>
  );
}
