"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { VendorBillBuilder } from "./vendor-bill-builder";
import type { VendorBill } from "./types";

/** Fetches an existing vendor bill client-side, then hands it to VendorBillBuilder for editing — mirrors invoices/invoice-edit-loader.tsx's own split-out-from-server-component reasoning. */
export function VendorBillEditLoader({ billId }: { billId: string }) {
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<VendorBill>(`/vendor-bills/${billId}`)
      .then((b) => {
        if (b.status !== "draft") {
          setError("Only a draft vendor bill can be edited. A recorded bill is immutable.");
          return;
        }
        setBill(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vendor bill."));
  }, [billId]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!bill) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return <VendorBillBuilder bill={bill} />;
}
