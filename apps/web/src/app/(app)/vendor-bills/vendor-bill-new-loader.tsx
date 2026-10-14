"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { VendorBillBuilder } from "./vendor-bill-builder";
import type { VendorBill } from "./types";

/** US-PUR-35 — `/vendor-bills/new?from=<id>` (Duplicate) opens the builder filled from that bill; without `from`, an empty one. */
export function VendorBillNewLoader({ from }: { from?: string }) {
  const [source, setSource] = useState<VendorBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from) return;
    apiClient
      .get<VendorBill>(`/vendor-bills/${from}`)
      .then(setSource)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open the bill to copy."));
  }, [from]);

  if (!from) return <VendorBillBuilder />;
  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!source) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  return <VendorBillBuilder source={source} />;
}
