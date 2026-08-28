"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../../lib/api-client";
import type { Job, JobVariationOrder } from "../types";
import { blankVariationLine, VariationOrderLineEditor, type EditableVariationLine } from "./variation-order-line-editor";

const QUOTE_STATUS_BADGE_CLASS: Record<JobVariationOrder["quote"]["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * S-04.9 — variation orders raised against this job. Each row wraps a real
 * quote (VariationOrdersService.list joins it in), so "raise a variation
 * order" opens a small line editor and creates a draft quote linked to the
 * job via `POST /jobs/:id/variation-orders`; from there the wrapped quote
 * goes through the ordinary Quotes send/accept flow on its own detail page
 * (linked here, not re-implemented). Once accepted, "Apply to job" folds
 * its total into the job's contract value (S-04.9's own explicit-action
 * design, see VariationOrdersService.apply's doc comment).
 */
export function VariationOrdersSection({
  job,
  canCreate,
  canApply,
  onJobChanged,
}: {
  job: Job;
  /** quotes.edit_own — raise a new variation order. */
  canCreate: boolean;
  /** invoices.manage — apply an accepted variation order to the job's contract value. */
  canApply: boolean;
  onJobChanged: () => void;
}) {
  const [variations, setVariations] = useState<JobVariationOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<EditableVariationLine[]>([blankVariationLine()]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<JobVariationOrder[]>(`/jobs/${job.id}/variation-orders`)
      .then(setVariations)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load variation orders."));
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setLines([blankVariationLine()]);
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreateError(null);
    if (!lines.length || lines.some((l) => l.type === "item" && !l.name.trim())) {
      setCreateError("Every line needs a name.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/jobs/${job.id}/variation-orders`, {
        lines: lines.map((l) => ({
          type: l.type,
          catalogItemId: l.catalogItemId,
          name: l.name,
          description: l.description || null,
          quantity: l.quantity,
          unitPriceAmount: l.unitPriceAmount.toString(),
          discountPercentage: l.discountPercentage,
          taxRatePercentage: l.taxRatePercentage,
        })),
      });
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this variation order.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApply(variationOrderId: string) {
    setError(null);
    setApplyingId(variationOrderId);
    try {
      await apiClient.post(`/jobs/${job.id}/variation-orders/${variationOrderId}/apply`);
      load();
      onJobChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply this variation order.");
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-on-surface">Variation orders</h3>
        {canCreate && (
          <Button variant="secondary" size="sm" onClick={openCreate}>
            Raise variation order
          </Button>
        )}
      </div>

      {!variations ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : variations.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">
          No variation orders yet — raise one when the scope of this job changes so it's tracked and billed separately.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {variations.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <a href={`/quotes/${v.quoteId}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                    {v.quote.number ?? "Draft variation quote"}
                  </a>
                  <Badge className={QUOTE_STATUS_BADGE_CLASS[v.quote.status]}>
                    {v.quote.status.charAt(0).toUpperCase() + v.quote.status.slice(1)}
                  </Badge>
                  {v.appliedAt && <Badge className="bg-paid-bg text-paid">Applied</Badge>}
                </div>
                <p className="text-[12px] text-on-surface-muted">
                  Raised {new Date(v.createdAt).toLocaleDateString()}
                  {v.appliedAt && <> · Applied {new Date(v.appliedAt).toLocaleDateString()}</>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] tabular-nums text-on-surface">
                  {toDecimalString({ amount: BigInt(v.quote.totalAmount), currency: v.quote.currency })} {v.quote.currency}
                </span>
                {!v.appliedAt && v.quote.status === "accepted" && canApply && (
                  <Button size="sm" onClick={() => handleApply(v.id)} disabled={applyingId === v.id}>
                    {applyingId === v.id ? <Spinner size="sm" /> : "Apply to job"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Raise a variation order</DialogTitle>
            <DialogDescription>
              Creates a draft quote linked to this job for {job.contactName ?? "the job's contact"}. Send and get it accepted through
              the ordinary quote flow, then apply it here to fold the change into the job's contract value.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {createError && (
              <Alert variant="critical">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <VariationOrderLineEditor lines={lines} onChange={setLines} currency={job.currency} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Create variation order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
