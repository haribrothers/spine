"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, Spinner, StatusChip } from "@spine/ui";
import { VENDOR_CREDIT_STATUS_LABELS, type VendorCreditStatus } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection } from "../../../components/attachments-section";
import { HistorySection } from "../../../components/history-section";
import { Row } from "./vendor-credit-builder";
import type { VendorCredit } from "./types";
import { ApplyVendorCreditDialog } from "./apply-vendor-credit-dialog";

/** Draft grey, Open blue, Used green, Void red — always with the word, never colour alone. */
export function VendorCreditStatusChip({ status }: { status: VendorCreditStatus }) {
  const label = VENDOR_CREDIT_STATUS_LABELS[status];
  if (status === "open") return <Badge className="bg-primary/10 text-primary">{label}</Badge>;
  return <StatusChip status={status === "used" ? "paid" : status === "void" ? "overdue" : "draft"}>{label}</StatusChip>;
}

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * US-PUR-24 — `VendorCreditDetail`: the credit, its lines and what's left
 * to use. A draft can be edited, deleted or recorded; a recorded credit
 * is fixed.
 */
export function VendorCreditDetail({ creditId }: { creditId: string }) {
  const router = useRouter();
  const [credit, setCredit] = useState<VendorCredit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canRecord = useCapability("vendor_credits.record");
  const canApply = useCapability("vendor_credits.apply");
  const [applyOpen, setApplyOpen] = useState(false);
  const canEdit = useCanEditOwnership(credit?.createdByUserId ?? null, { own: "vendor_credits.edit_own", others: "vendor_credits.edit_others" });
  const canDelete = useCanEditOwnership(credit?.createdByUserId ?? null, { own: "vendor_credits.delete_own", others: "vendor_credits.delete_others" });

  const load = useCallback(() => {
    apiClient
      .get<VendorCredit>(`/vendor-credits/${creditId}`)
      .then(setCredit)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this vendor credit."));
  }, [creditId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!credit) {
    return error ? (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const isDraft = credit.status === "draft";
  const balance = BigInt(credit.balanceAmount);

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-on-surface">{credit.number ?? "Draft vendor credit"}</h2>
            <VendorCreditStatusChip status={credit.status} />
          </div>
          <p className="text-[13px] text-on-surface-muted">
            {credit.contactName} · their {credit.vendorReference} · {day(credit.date)}
            {credit.billId && (
              <>
                {" · against "}
                <Link href={`/vendor-bills/${credit.billId}`} className="text-primary hover:underline">
                  bill {credit.billNumber ?? ""}
                </Link>
              </>
            )}
          </p>
          {credit.status === "open" && (
            <p className="text-[14px] font-medium text-on-surface" data-testid="credit-balance">
              Open — {formatMoney(balance, credit.currency)} to use
            </p>
          )}
          {credit.status === "void" && credit.voidReason && <p className="text-[14px] text-on-surface">Void — {credit.voidReason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HistorySection endpoint={`/vendor-credits/${credit.id}/history`} subjectLabel="this vendor credit" />
          {isDraft && canEdit && (
            <Button variant="secondary" onClick={() => router.push(`/vendor-credits/${credit.id}/edit`)} disabled={busy}>
              Edit
            </Button>
          )}
          {isDraft && canDelete && (
            <Button variant="secondary" onClick={() => act(async () => {
              await apiClient.delete(`/vendor-credits/${credit.id}`);
              router.push("/vendor-credits");
            })} disabled={busy}>
              Delete draft
            </Button>
          )}
          {credit.status === "open" && canApply && (
            <Button onClick={() => setApplyOpen(true)} disabled={busy}>
              Apply to bills
            </Button>
          )}
          {isDraft && canRecord && (
            <Button onClick={() => act(() => apiClient.post(`/vendor-credits/${credit.id}/record`))} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Record"}
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-on-surface">Lines</h2>
        {(credit.lines ?? []).map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-4 border-t border-border pt-3 first:border-0 first:pt-0">
            <div>
              <p className="text-[14px] text-on-surface">{line.name}</p>
              {line.type === "item" && (
                <p className="text-[12px] text-on-surface-muted">
                  {line.quantity} × {formatMoney(BigInt(line.unitPriceAmount), credit.currency)}
                </p>
              )}
            </div>
            {line.type === "item" && <span className="tabular-nums text-on-surface">{formatMoney(BigInt(line.lineTotalAmount), credit.currency)}</span>}
          </div>
        ))}
      </Card>

      {(credit.allocations ?? []).length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="credit-allocations">
          <h2 className="text-[15px] font-semibold text-on-surface">Applied to bills</h2>
          {credit.allocations!.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
              <Link href={`/vendor-bills/${a.billId}`} className="text-primary hover:underline">
                Bill {a.billNumber}
              </Link>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-on-surface">{formatMoney(BigInt(a.amount), credit.currency)}</span>
                {canApply && credit.status !== "void" && (
                  <Button variant="ghost" size="sm" aria-label={`Remove from bill ${a.billNumber}`} onClick={() => act(() => apiClient.delete(`/vendor-credits/${credit.id}/allocations/${a.id}`))} disabled={busy}>
                    Remove
                  </Button>
                )}
              </span>
            </div>
          ))}
        </Card>
      )}

      <AttachmentsSection entityType="vendor_credit" entityId={credit.id} />

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <Row label="Subtotal" value={formatMoney(BigInt(credit.subtotalAmount), credit.currency)} />
        <Row label="Tax" value={formatMoney(BigInt(credit.taxAmount), credit.currency)} />
        <div className="border-t border-border pt-2">
          <Row label="Total credit" value={formatMoney(BigInt(credit.totalAmount), credit.currency)} emphasize />
        </div>
        {credit.status !== "draft" && <Row label="Left to use" value={formatMoney(balance, credit.currency)} />}
      </Card>
      <ApplyVendorCreditDialog open={applyOpen} onOpenChange={setApplyOpen} credit={credit} onApplied={load} />
    </div>
  );
}
