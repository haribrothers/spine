"use client";

import { Card } from "@spine/ui";
import { fileUrl } from "../../../components/attachments-section";
import type { Quote } from "./types";

function onDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function atTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * US-QUO-20 · `QuoteDetailInPerson` — how an answered quote was answered:
 * on site with the customer's signature and the person who recorded it, or
 * online through the link. Nothing until the customer answers.
 */
export function AcceptancePanel({ quote }: { quote: Quote }) {
  if ((quote.status !== "accepted" && quote.status !== "rejected") || !quote.respondedAt) return null;
  const when = quote.respondedAt;

  if (quote.acceptanceMethod !== "in_person") {
    return (
      <Card data-testid="quote-acceptance">
        <p className="text-[14px] text-on-surface">
          {quote.status === "accepted" ? "Accepted" : "Declined"} online by the customer on {onDate(when)}.
        </p>
        {quote.responseComment && <p className="mt-1 text-[13px] text-on-surface-muted">“{quote.responseComment}”</p>}
      </Card>
    );
  }

  if (quote.status === "rejected") {
    return (
      <Card data-testid="quote-acceptance">
        <p className="text-[14px] font-semibold text-on-surface">Declined on site</p>
        <p className="mt-1 text-[14px] text-on-surface">
          On {onDate(when)} at {atTime(when)}, recorded by <strong>{quote.acceptedByName ?? "a team member"}</strong>.
        </p>
        {quote.responseComment && <p className="mt-1 text-[13px] text-on-surface-muted">Reason: {quote.responseComment}</p>}
      </Card>
    );
  }

  const signature = quote.signatureFileId ? fileUrl(quote.signatureFileId) : null;
  return (
    <Card data-testid="quote-acceptance" className="flex flex-wrap items-center gap-5">
      {signature && (
        <div className="flex h-24 w-56 items-center justify-center rounded-md border border-border bg-surface p-2">
          {/* The customer's signature, through the authorised file route. The phone saves it dark on white, like a document, in both themes. */}
          <img src={signature} alt={`Signature of ${quote.acceptedSignerName ?? "the customer"}`} className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[14px] font-semibold text-on-surface">Accepted on site</p>
        <p className="text-[14px] text-on-surface">
          Signed by <strong>{quote.acceptedSignerName ?? "the customer"}</strong> on {onDate(when)} at {atTime(when)}, witnessed by <strong>{quote.acceptedByName ?? "a team member"}</strong>
        </p>
        {signature && (
          <a href={signature} target="_blank" rel="noreferrer" className="text-[14px] text-primary underline-offset-2 hover:underline">
            View signature full size
          </a>
        )}
      </div>
    </Card>
  );
}
