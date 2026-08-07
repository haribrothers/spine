"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Badge, Button, Card, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { apiClient } from "../../lib/api-client";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";
import { useEntityToast } from "./entity-toast";

interface MemberRow {
  userId: string;
  role: string;
}

const STATUS_BADGE_CLASS: Record<Quote["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * Read-only-ish detail view for a quote — full line breakdown, totals, and
 * status. Stage 1 has no PDF/email/public-link, so this page (not a
 * customer-facing share link) is the only place a quote's contents are
 * ever viewed. Offers: Edit (draft only, routes to the builder), Mark as
 * sent (draft only — see quotes.service.ts's own comment on why this
 * isn't labeled "Send", to avoid implying an email that Stage 1 doesn't
 * send), Revise (sent/accepted/rejected, not yet superseded), and Approve
 * discount (owner only, when `discountRequiresApproval` and not yet
 * approved) — S-03.9's affordance, deliberately a single button rather
 * than a richer approval workflow, per the task brief's own scope note.
 */
export function QuoteDetail({ quoteId, currentUserId }: { quoteId: string; currentUserId: string | null }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(() => {
    apiClient
      .get<Quote>(`/quotes/${quoteId}`)
      .then(setQuote)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quote."));
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!currentUserId) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then((members) => {
        const self = members.find((m) => m.userId === currentUserId);
        setIsOwner(self?.role === "owner");
      })
      .catch(() => {});
  }, [currentUserId]);

  async function handleMarkAsSent() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Quote>(`/quotes/${quote.id}/send`);
      setQuote(updated);
      showToast("Quote marked as sent", `${updated.number} is now issued. No email has been sent — that's coming in a later update.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this quote as sent.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const revised = await apiClient.post<Quote>(`/quotes/${quote.id}/revise`);
      router.push(`/quotes/${revised.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revise this quote.");
      setBusy(false);
    }
  }

  async function handleApproveDiscount() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Quote>(`/quotes/${quote.id}/approve-discount`);
      setQuote(updated);
      showToast("Discount approved", "This quote can now be sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this quote's discount.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/quotes/${quote.id}`);
      router.push("/quotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this quote.");
      setBusy(false);
    }
  }

  if (error && !quote) {
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

  const canEdit = quote.status === "draft";
  const canRevise = quote.status !== "draft" && !quote.isSuperseded;
  const needsApproval = quote.discountRequiresApproval && !quote.approvedByUserId;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-on-surface">{quote.number ?? "Draft quote"}</h2>
              <Badge className={STATUS_BADGE_CLASS[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
              {quote.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
              {quote.isSuperseded && <Badge className="bg-draft-bg text-draft">Superseded by v{quote.version + 1}</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-on-surface-muted">
              {quote.contactName ?? "Unknown contact"} · Version {quote.version}
              {quote.validUntil && <> · Valid until {new Date(quote.validUntil).toLocaleDateString()}</>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/quotes/${quote.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canEdit && !needsApproval && (
              <Button onClick={handleMarkAsSent} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Mark as sent"}
              </Button>
            )}
            {canRevise && (
              <Button onClick={handleRevise} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Revise"}
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete draft
              </Button>
            )}
          </div>
        </div>

        {needsApproval && (
          <Alert variant={isOwner ? "warning" : "critical"}>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>This quote's discount is above the org's approval threshold and needs owner sign-off before it can be sent.</span>
              {isOwner && (
                <Button size="sm" onClick={handleApproveDiscount} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Approve discount"}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {quote.approvedByUserId && (
          <p className="text-[13px] text-on-surface-muted">
            Discount approved {quote.approvedAt ? new Date(quote.approvedAt).toLocaleString() : ""}.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-on-surface">Lines</h3>
        <div className="flex flex-col divide-y divide-border">
          {(quote.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className={line.type === "heading" ? "font-semibold text-on-surface" : "text-on-surface"}>{line.name}</p>
                {line.description && <p className="text-[13px] text-on-surface-muted">{line.description}</p>}
                {line.type === "item" && (
                  <p className="text-[12px] text-on-surface-muted">
                    {line.quantity} × {toDecimalString({ amount: BigInt(line.unitPriceAmount), currency: quote.currency })}
                    {line.discountPercentage > 0 && <> · {line.discountPercentage}% off</>}
                    {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
                  </p>
                )}
              </div>
              {line.type === "item" && (
                <span className="shrink-0 font-mono tabular-nums text-on-surface">
                  {toDecimalString({ amount: BigInt(line.lineTotalAmount), currency: quote.currency })}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <TotalRow label="Subtotal" value={quote.subtotalAmount} currency={quote.currency} />
        <TotalRow label="Discount" value={`-${toDecimalString({ amount: BigInt(quote.discountAmount), currency: quote.currency })}`} currency="" raw />
        <TotalRow label="Tax" value={quote.taxAmount} currency={quote.currency} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={quote.totalAmount} currency={quote.currency} emphasize />
        </div>
      </Card>

      {(quote.notes || quote.termsAndConditions) && (
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quote.notes && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
              <p className="whitespace-pre-wrap text-[14px] text-on-surface">{quote.notes}</p>
            </div>
          )}
          {quote.termsAndConditions && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Terms & conditions</h3>
              <p className="whitespace-pre-wrap text-[14px] text-on-surface">{quote.termsAndConditions}</p>
            </div>
          )}
        </Card>
      )}

      {toast}
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  emphasize,
  raw,
}: {
  label: string;
  value: string;
  currency: string;
  emphasize?: boolean;
  raw?: boolean;
}) {
  const display = raw ? value : `${toDecimalString({ amount: BigInt(value), currency })} ${currency}`;
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${emphasize ? "text-[16px] font-bold text-on-surface" : "text-[14px] text-on-surface"}`}>
        {display}
      </span>
    </div>
  );
}
