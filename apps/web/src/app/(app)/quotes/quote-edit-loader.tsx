"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { QuoteBuilder } from "./quote-builder";
import type { Quote } from "./types";
import { useT } from "../../../lib/i18n";

/** Fetches an existing quote client-side, then hands it to QuoteBuilder for editing — split out from the `/quotes/:id/edit` server component since fetching needs the browser-side `apiClient`/cookie session, matching QuoteDetail's own pattern. */
export function QuoteEditLoader({ quoteId }: { quoteId: string }) {
  const t = useT();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Quote>(`/quotes/${quoteId}`)
      .then((q) => {
        if (q.status !== "draft") {
          setError(t("quotes.editLoader.notDraft"));
          return;
        }
        setQuote(q);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("quotes.editLoader.loadFailed")));
  }, [quoteId]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!quote) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return <QuoteBuilder quote={quote} />;
}
