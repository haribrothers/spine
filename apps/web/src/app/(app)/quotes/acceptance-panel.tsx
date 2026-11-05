"use client";

import { Card } from "@spine/ui";
import { fileUrl } from "../../../components/attachments-section";
import type { Quote } from "./types";
import { useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

function onDate(iso: string): string {
  return new Date(iso).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });
}

function atTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(orgLocaleTag(), { hour: "numeric", minute: "2-digit" });
}

/**
 * US-QUO-20 · `QuoteDetailInPerson` — how an answered quote was answered:
 * on site with the customer's signature and the person who recorded it, or
 * online through the link. Nothing until the customer answers.
 */
export function AcceptancePanel({ quote }: { quote: Quote }) {
  const t = useT();
  if ((quote.status !== "accepted" && quote.status !== "rejected") || !quote.respondedAt) return null;
  const when = quote.respondedAt;

  if (quote.acceptanceMethod !== "in_person") {
    return (
      <Card data-testid="quote-acceptance">
        <p className="text-[14px] text-on-surface">
          {quote.status === "accepted" ? t("quotes.acceptance.acceptedOnline", { date: onDate(when) }) : t("quotes.acceptance.declinedOnline", { date: onDate(when) })}
        </p>
        {quote.responseComment && <p className="mt-1 text-[13px] text-on-surface-muted">{t("quotes.acceptance.quotedComment", { comment: quote.responseComment })}</p>}
      </Card>
    );
  }

  if (quote.status === "rejected") {
    return (
      <Card data-testid="quote-acceptance">
        <p className="text-[14px] font-semibold text-on-surface">{t("quotes.acceptance.declinedOnSite")}</p>
        <p className="mt-1 text-[14px] text-on-surface">
          {t("quotes.acceptance.declinedOnSiteDetail", { date: onDate(when), time: atTime(when) })}<strong>{quote.acceptedByName ?? t("quotes.acceptance.teamMember")}</strong>.
        </p>
        {quote.responseComment && <p className="mt-1 text-[13px] text-on-surface-muted">{t("quotes.acceptance.reason", { comment: quote.responseComment })}</p>}
      </Card>
    );
  }

  const signature = quote.signatureFileId ? fileUrl(quote.signatureFileId) : null;
  return (
    <Card data-testid="quote-acceptance" className="flex flex-wrap items-center gap-5">
      {signature && (
        <div className="flex h-24 w-56 items-center justify-center rounded-md border border-border bg-surface p-2">
          {/* The customer's signature, through the authorised file route. The phone saves it dark on white, like a document, in both themes. */}
          <img src={signature} alt={t("quotes.acceptance.signatureAlt", { name: quote.acceptedSignerName ?? t("quotes.acceptance.theCustomer") })} className="max-h-full max-w-full object-contain" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[14px] font-semibold text-on-surface">{t("quotes.acceptance.acceptedOnSite")}</p>
        <p className="text-[14px] text-on-surface">
          {t("quotes.acceptance.signedBy")}<strong>{quote.acceptedSignerName ?? t("quotes.acceptance.theCustomer")}</strong>{t("quotes.acceptance.signedOnWitnessedBy", { date: onDate(when), time: atTime(when) })}<strong>{quote.acceptedByName ?? t("quotes.acceptance.teamMember")}</strong>
        </p>
        {signature && (
          <a href={signature} target="_blank" rel="noreferrer" className="text-[14px] text-primary underline-offset-2 hover:underline">
            {t("quotes.acceptance.viewSignature")}
          </a>
        )}
      </div>
    </Card>
  );
}
