"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { InvoiceBuilder } from "./invoice-builder";
import type { Invoice } from "./types";

/** Fetches an existing invoice client-side, then hands it to InvoiceBuilder for editing — mirrors quotes/quote-edit-loader.tsx's own split-out-from-server-component reasoning. */
export function InvoiceEditLoader({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Invoice>(`/invoices/${invoiceId}`)
      .then((inv) => {
        if (inv.status !== "draft") {
          setError("Only a draft invoice can be edited. An issued invoice is immutable.");
          return;
        }
        setInvoice(inv);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load invoice."));
  }, [invoiceId]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!invoice) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return <InvoiceBuilder invoice={invoice} />;
}
