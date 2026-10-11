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
  useConfirm,
} from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import { PlaceOfSupplyNotice, usePlaceOfSupply } from "../../../..//components/place-of-supply";
import { useCapability } from "../../../../lib/capabilities-context";
import type { Job, JobVariationOrder } from "../types";
import { blankVariationLine, VariationOrderLineEditor, type EditableVariationLine } from "./variation-order-line-editor";
import { formatMoney } from "../../../../lib/money";
import { useToast } from "../../../../components/toast-host";

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
/** `raiseRequest` — the job page's "Raise variation" (US-JOB-34) opens the create dialog when it changes. */
export function VariationOrdersSection({ job, onJobChanged, raiseRequest = 0 }: { job: Job; onJobChanged: () => void; raiseRequest?: number }) {
  const canCreate = useCapability("variation_orders.edit_own");
  const canApply = useCapability("variation_orders.apply");
  const showToast = useToast();
  const [variations, setVariations] = useState<JobVariationOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lines, setLines] = useState<EditableVariationLine[]>([blankVariationLine()]);
  // D-183 — no place-of-supply field: the job customer's address picks intra- or inter-state tax.
  const pos = usePlaceOfSupply({ contactId: job.contactId, lines, setLines });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  useEffect(() => {
    if (raiseRequest > 0) openCreate();
  }, [raiseRequest]);

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
          taxRateId: l.taxRateId,
          taxGroupId: l.taxGroupId,
          isTaxInclusive: l.isTaxInclusive,
          supplyClass: l.supplyClass,
          hsnSac: l.hsnSac || null,
        })),
      });
      setCreateOpen(false);
      load();
      onJobChanged();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this variation order.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApply(variationOrderId: string) {
    const v = variations?.find((o) => o.id === variationOrderId);
    const ok = await confirm({
      title: "Apply this variation to the job?",
      description: v
        ? `${formatMoney(BigInt(v.quote.totalAmount), v.quote.currency)} from ${v.quote.number ?? "the variation quote"} is added to ${job.name}'s contract value, and its percentage milestones are worked out again. This can't be undone.`
        : "Its amount is added to the job's contract value, and its percentage milestones are worked out again. This can't be undone.",
      confirmLabel: "Apply to job",
    });
    if (!ok) return;
    setError(null);
    setApplyingId(variationOrderId);
    try {
      await apiClient.post(`/jobs/${job.id}/variation-orders/${variationOrderId}/apply`);
      showToast(
        "Variation applied",
        v ? `${formatMoney(BigInt(v.quote.totalAmount), v.quote.currency)} from ${v.quote.number ?? "the variation quote"} is now part of ${job.name}'s contract value.` : `${job.name}'s contract value has been updated.`,
      );
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
                <span className="text-[13px] tabular-nums text-on-surface">
                  {formatMoney(BigInt(v.quote.totalAmount), v.quote.currency)}
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
            <PlaceOfSupplyNotice notice={pos.notice} />
            <VariationOrderLineEditor lines={lines} onChange={setLines} currency={job.currency} supplyType={pos.supplyType} exportUnderLut={pos.exportUnderLut} flaggedKeys={pos.flagged} />
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
      {confirmDialog}
    </Card>
  );
}
