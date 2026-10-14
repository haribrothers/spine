"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, RichTextContent, RichTextEditor, SpineLogo, Spinner } from "@spine/ui";
import { CheckCircle2, Clock, LinkIcon, XCircle } from "lucide-react";
import type { PublicQuoteUnavailableBusiness, PublicQuoteView as PublicQuoteViewData } from "./types";
import { formatMoney } from "../../../lib/money";

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
        setState({ kind: "error", message: "Something went wrong loading this quote. Please try again." });
        return;
      }
      const quote = (await res.json()) as PublicQuoteViewData;
      setState({ kind: "ready", quote });
    } catch {
      setState({ kind: "error", message: "Could not reach the server. Check your connection and try again." });
    }
  }, [token]);

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
        setActionError("Too many attempts — please wait a minute and try again.");
        return;
      }
      if (!res.ok) {
        let message = "This quote could not be updated. It may have already been responded to or the link may have expired.";
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
      setActionError("Could not reach the server. Check your connection and try again.");
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
          <h1 className="text-[20px] font-semibold text-on-surface">This quote link isn&apos;t valid</h1>
          <p className="text-[14px] text-on-surface-muted">Check that you opened the whole link from the email, or ask the business that sent it for a new one.</p>
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
              <p className="text-[13px] text-on-surface-muted">{quote.business?.name ?? "Quote"}</p>
              <h1 className="text-[20px] font-semibold text-on-surface">{quote.number ?? "Quote"}</h1>
              {quote.title && <p className="text-[15px] font-medium text-on-surface" data-testid="public-quote-title">{quote.title}</p>}
            </div>
          </div>
          <StatusBadge status={quote.status} />
        </div>
        {quote.contactName && <p className="text-[13px] text-on-surface-muted">Prepared for {quote.contactName}</p>}
        {quote.validUntil && !isResolved && (
          <p className="text-[13px] text-on-surface-muted">Valid until {new Date(quote.validUntil).toLocaleDateString()}</p>
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
                    {line.quantity} × {formatMoney(BigInt(line.unitPriceAmount), quote.currency)}
                    {line.discountPercentage > 0 && <> · {line.discountPercentage}% off</>}
                    {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
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
        <TotalRow label="Subtotal" value={fmt(quote.subtotalAmount)} />
        {BigInt(quote.discountAmount) > 0n && <TotalRow label="Discount" value={fmt(-BigInt(quote.discountAmount))} />}
        <TotalRow label="Tax" value={fmt(quote.taxAmount)} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={fmt(quote.totalAmount)} emphasize />
        </div>
      </Card>

      {(quote.notes || quote.termsAndConditions) && (
        <Card className="flex flex-col gap-4">
          {quote.notes && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
              <RichTextContent html={quote.notes} />
            </div>
          )}
          {quote.termsAndConditions && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Terms &amp; conditions</h3>
              <RichTextContent html={quote.termsAndConditions} />
            </div>
          )}
        </Card>
      )}

      {isResolved ? (
        <Card className="flex flex-col gap-2">
          <p className={`flex items-center gap-1.5 text-[14px] font-medium ${quote.status === "accepted" ? "text-paid" : "text-overdue"}`}>
            {quote.status === "accepted" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            You {quote.status} this quote
            {quote.respondedAt && <> on {new Date(quote.respondedAt).toLocaleString()}</>}.
          </p>
          {quote.responseComment && <RichTextContent html={quote.responseComment} className="text-on-surface-muted" />}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <h3 className="text-[14px] font-semibold text-on-surface">Your decision</h3>
          <RichTextEditor value={comment} onValueChange={setComment} placeholder="Add an optional comment…" />
          {actionError && (
            <Alert variant="critical">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => respond("accept")} disabled={busy !== null}>
              {busy === "accept" ? <Spinner size="sm" /> : "Accept quote"}
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => respond("reject")} disabled={busy !== null}>
              {busy === "reject" ? <Spinner size="sm" /> : "Decline"}
            </Button>
          </div>
        </Card>
      )}
    </PageShell>
  );
}

/** US-QUO-21 — whose quote it was and how to reach them, from the business profile. */
function QuoteLinkExpired({ business }: { business: PublicQuoteUnavailableBusiness }) {
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
        <h1 className="text-[20px] font-semibold text-on-surface">This quote link has expired</h1>
        <p className="text-[14px] text-on-surface">
          The link you opened is no longer active — the quote may have been updated or replaced. Contact {business.name} and they&apos;ll send
          you the latest version.
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
        Sent with Spine
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
  sent: "Awaiting your response",
  accepted: "Accepted",
  rejected: "Declined",
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
