"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, RichTextContent, RichTextEditor, SpineLogo, Spinner } from "@spine/ui";
import { CheckCircle2, Clock, LinkIcon, XCircle } from "lucide-react";
import type { PublicQuoteUnavailableBusiness, PublicQuoteView as PublicQuoteViewData } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { t as translate, useT } from "../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "expired"; business: PublicQuoteUnavailableBusiness }
  | { kind: "error"; message: string }
  | { kind: "ready"; quote: PublicQuoteViewData };

/**
 * PRD F3 Stage 3 (S-03.5/S-03.6) — the public, unauthenticated quote page a
 * customer lands on from the emailed link. Deliberately a fresh component,
 * not a reuse of `apps/web/src/app/quotes/quote-detail.tsx` (that component
 * assumes an authenticated session, calls `apiClient` which sends
 * `credentials: "include"` cookies this visitor doesn't have, and exposes
 * internal actions like Edit/Delete/Revise that make no sense here).
 * Mobile-first per S-03.5's own wording ("read the quote on my phone") —
 * single-column, generous tap targets, no reliance on hover states.
 *
 * Talks to `GET/POST /public/quotes/:token` directly with a plain `fetch`
 * (no cookies, no Idempotency-Key — those are authenticated-app concerns;
 * this route has neither a session nor `apiClient`'s convention to follow).
 */
export function PublicQuoteView({ token }: { token: string }) {
  const t = useT();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`${API_URL}/public/quotes/${encodeURIComponent(token)}`, { cache: "no-store" });
      // US-QUO-21: 410 is a link we sent that no longer works (with who to
      // contact); 404 matches nothing.
      if (res.status === 410) {
        const body = (await res.json().catch(() => null)) as { business?: PublicQuoteUnavailableBusiness } | null;
        setState(body?.business ? { kind: "expired", business: body.business } : { kind: "invalid" });
        return;
      }
      if (res.status === 404) {
        setState({ kind: "invalid" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: t("publicQuote.loadFailed") });
        return;
      }
      const quote = (await res.json()) as PublicQuoteViewData;
      setState({ kind: "ready", quote });
    } catch {
      setState({ kind: "error", message: t("publicQuote.unreachable") });
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(outcome: "accept" | "reject") {
    setBusy(outcome);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/public/quotes/${encodeURIComponent(token)}/${outcome}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      if (res.status === 429) {
        setActionError(t("publicQuote.tooManyAttempts"));
        return;
      }
      if (!res.ok) {
        let message = t("publicQuote.updateFailed");
        try {
          const data = await res.json();
          if (typeof data?.message === "string") message = data.message;
        } catch {
          // keep default
        }
        setActionError(message);
        return;
      }
      const quote = (await res.json()) as PublicQuoteViewData;
      setState({ kind: "ready", quote });
    } catch {
      setActionError(t("publicQuote.unreachable"));
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state.kind === "expired") return <QuoteLinkExpired business={state.business} />;

  if (state.kind === "invalid") {
    return (
      <PageShell>
        <Card className="flex flex-col gap-3" data-testid="quote-link-invalid">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-draft-bg text-draft" aria-hidden="true">
            <LinkIcon size={20} />
          </span>
          <h1 className="text-[20px] font-semibold text-on-surface">{t("publicQuote.invalidTitle")}</h1>
          <p className="text-[14px] text-on-surface-muted">{t("publicQuote.invalidDescription")}</p>
        </Card>
      </PageShell>
    );
  }

  if (state.kind === "error") {
    return (
      <PageShell>
        <Alert variant="critical">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const { quote } = state;
  // The business's locale comes with the quote; this page is outside the signed-in layout.
  const fmt = (amount: string | bigint) => formatMoney(amount, quote.currency, quote.locale ?? undefined);
  const isResolved = quote.status === "accepted" || quote.status === "rejected";

  return (
    <PageShell>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {quote.business?.logoUrl && (
              // Plain <img>, not next/image — an external/user-uploaded logo
              // URL, not a local static asset for Next's optimizer to manage
              // (mirrors apps/web/src/app/contacts/contact-logo.tsx's own
              // precedent for the same reasoning).
              <img src={quote.business.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded object-contain" />
            )}
            <div>
              <p className="text-[13px] text-on-surface-muted">{quote.business?.name ?? t("publicQuote.quote")}</p>
              <h1 className="text-[20px] font-semibold text-on-surface">{quote.number ?? t("publicQuote.quote")}</h1>
              {quote.title && <p className="text-[15px] font-medium text-on-surface" data-testid="public-quote-title">{quote.title}</p>}
            </div>
          </div>
          <StatusBadge status={quote.status} />
        </div>
        {quote.contactName && <p className="text-[13px] text-on-surface-muted">{t("publicQuote.preparedFor", { name: quote.contactName })}</p>}
        {quote.validUntil && !isResolved && (
          <p className="text-[13px] text-on-surface-muted">{t("publicQuote.validUntil", { date: new Date(quote.validUntil).toLocaleDateString(orgLocaleTag()) })}</p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col divide-y divide-border">
          {quote.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className={line.type === "heading" ? "text-[15px] font-semibold text-on-surface" : line.type === "text" ? "text-[14px] text-on-surface-muted" : "text-on-surface"}>{line.name}</p>
                {line.description && <p className="text-[13px] text-on-surface-muted">{line.description}</p>}
                {line.type === "item" && (
                  <p className="text-[12px] text-on-surface-muted">
                    {t("publicQuote.lineQtyPrice", { quantity: line.quantity, price: formatMoney(BigInt(line.unitPriceAmount), quote.currency) })}
                    {line.discountPercentage > 0 && t("publicQuote.lineDiscount", { percent: line.discountPercentage })}
                    {line.taxRatePercentage > 0 && t("publicQuote.lineTax", { percent: line.taxRatePercentage })}
                  </p>
                )}
              </div>
              {line.type === "item" && (
                <span className="shrink-0 tabular-nums text-on-surface">{fmt(line.lineTotalAmount)}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <TotalRow label={t("publicQuote.subtotal")} value={fmt(quote.subtotalAmount)} />
        {BigInt(quote.discountAmount) > 0n && <TotalRow label={t("publicQuote.discount")} value={fmt(-BigInt(quote.discountAmount))} />}
        <TotalRow label={t("publicQuote.tax")} value={fmt(quote.taxAmount)} />
        <div className="border-t border-border pt-2">
          <TotalRow label={t("publicQuote.total")} value={fmt(quote.totalAmount)} emphasize />
        </div>
      </Card>

      {(quote.notes || quote.termsAndConditions) && (
        <Card className="flex flex-col gap-4">
          {quote.notes && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">{t("publicQuote.notes")}</h3>
              <RichTextContent html={quote.notes} />
            </div>
          )}
          {quote.termsAndConditions && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">{t("publicQuote.terms")}</h3>
              <RichTextContent html={quote.termsAndConditions} />
            </div>
          )}
        </Card>
      )}

      {isResolved ? (
        <Card className="flex flex-col gap-2">
          <p className={`flex items-center gap-1.5 text-[14px] font-medium ${quote.status === "accepted" ? "text-paid" : "text-overdue"}`}>
            {quote.status === "accepted" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {quote.status === "accepted"
              ? quote.respondedAt
                ? t("publicQuote.youAcceptedOn", { date: new Date(quote.respondedAt).toLocaleString(orgLocaleTag()) })
                : t("publicQuote.youAccepted")
              : quote.respondedAt
                ? t("publicQuote.youRejectedOn", { date: new Date(quote.respondedAt).toLocaleString(orgLocaleTag()) })
                : t("publicQuote.youRejected")}
          </p>
          {quote.responseComment && <RichTextContent html={quote.responseComment} className="text-on-surface-muted" />}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <h3 className="text-[14px] font-semibold text-on-surface">{t("publicQuote.yourDecision")}</h3>
          <RichTextEditor value={comment} onValueChange={setComment} placeholder={t("publicQuote.commentPlaceholder")} />
          {actionError && (
            <Alert variant="critical">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => respond("accept")} disabled={busy !== null}>
              {busy === "accept" ? <Spinner size="sm" /> : t("publicQuote.accept")}
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => respond("reject")} disabled={busy !== null}>
              {busy === "reject" ? <Spinner size="sm" /> : t("publicQuote.decline")}
            </Button>
          </div>
        </Card>
      )}
    </PageShell>
  );
}

/** US-QUO-21 — whose quote it was and how to reach them, from the business profile. */
function QuoteLinkExpired({ business }: { business: PublicQuoteUnavailableBusiness }) {
  const t = useT();
  return (
    <PageShell>
      <div className="flex flex-col gap-1">
        {business.logoDataUri && <img src={business.logoDataUri} alt="" className="h-10 w-10 rounded object-contain" />}
        <p className="text-[16px] font-semibold text-on-surface">{business.name}</p>
      </div>
      <Card className="flex flex-col gap-3" data-testid="quote-link-expired">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-due-soon-bg text-due-soon" aria-hidden="true">
          <Clock size={20} />
        </span>
        <h1 className="text-[20px] font-semibold text-on-surface">{t("publicQuote.expiredTitle")}</h1>
        <p className="text-[14px] text-on-surface">
          {t("publicQuote.expiredDescription", { business: business.name })}
        </p>
        <address className="flex flex-col gap-0.5 rounded-md bg-surface-sunken p-4 text-[14px] not-italic text-on-surface">
          <span className="font-semibold">{business.name}</span>
          {business.address && <span className="whitespace-pre-line">{business.address}</span>}
          {business.email && (
            <a href={`mailto:${business.email}`} className="text-primary hover:underline">
              {business.email}
            </a>
          )}
          {business.phone && (
            <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">
              {business.phone}
            </a>
          )}
        </address>
      </Card>
      {/* US-SET-26: the mark before the words, skipped by screen readers since the words say it. */}
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-on-surface-muted">
        <SpineLogo decorative size={20} />
        {t("publicQuote.sentWithSpine")}
      </p>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">{children}</div>;
}

const STATUS_BADGE_CLASS: Record<PublicQuoteViewData["status"], string> = {
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};
const STATUS_LABEL: Record<PublicQuoteViewData["status"], string> = {
  sent: translate("publicQuote.statusSent"),
  accepted: translate("publicQuote.statusAccepted"),
  rejected: translate("publicQuote.statusRejected"),
};

function StatusBadge({ status }: { status: PublicQuoteViewData["status"] }) {
  return <Badge className={STATUS_BADGE_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}

function TotalRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>{label}</span>
      <span className={`tabular-nums ${emphasize ? "text-[16px] font-bold text-on-surface" : "text-[14px] text-on-surface"}`}>
        {value}
      </span>
    </div>
  );
}
