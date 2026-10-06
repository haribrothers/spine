"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  FormField,
  Input,
  Spinner,
} from "@spine/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { HistorySection } from "../../../components/history-section";
import { useEntityToast } from "./entity-toast";
import { VendorPaymentsSection } from "./vendor-payments-section";
import { VENDOR_BILL_STATUS_LABELS, type VendorBill } from "./types";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection } from "../../../components/attachments-section";
import { useCapability } from "../../../lib/capabilities-context";
import { RecurringBillDialog } from "./recurring/recurring-bill-dialog";

const STATUS_BADGE_CLASS: Record<VendorBill["status"], string> = {
  draft: "bg-draft-bg text-draft",
  recorded: "bg-due-soon-bg text-due-soon",
  void: "bg-overdue-bg text-overdue",
};

/**
 * Detail view for a vendor bill — full line breakdown, totals, and status.
 * Offers: Edit (draft only), Record (draft only — the posting action,
 * §7.2 "Vendor bill recorded"), Void (recorded only — requires a reason,
 * mirroring S-05.8's void flow), Delete draft (draft only). No PDF/email —
 * neither exists for vendor bills (they're records of what the org owes,
 * not a document sent to anyone). Mirrors invoices/invoice-detail.tsx's
 * overall structure, trimmed accordingly.
 */
export function VendorBillDetail({ billId }: { billId: string }) {
  const router = useRouter();
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  // US-PUR-29 — "Make recurring" starts a recurring bill from this one.
  const canManageRecurring = useCapability("vendor_bills.manage_recurring");
  const [recurringOpen, setRecurringOpen] = useState(false);
  // Record Vendor Payment happens on the standalone /vendor-payments page
  // (see canRecordPayment's own button below) rather than an inline
  // dialog here, since a vendor payment can span several of a vendor's
  // bills at once (S-07.8) — so there's no local trigger to bump this key,
  // just the fixed value on first render. Kept as a prop (not inlined) so
  // a future inline-record flow can wire a real setter without changing
  // VendorPaymentsSection's own contract.
  const paymentsRefreshKey = 0;
  const { show: showToast, toast } = useEntityToast();

  const load = useCallback(() => {
    apiClient
      .get<VendorBill>(`/vendor-bills/${billId}`)
      .then(setBill)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vendor bill."));
  }, [billId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRecord() {
    if (!bill) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/record`);
      setBill(updated);
      showToast("Vendor bill recorded", `${updated.billNumber} has been recorded and posted to the ledger.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    if (!bill) return;
    if (!voidReason.trim()) {
      setVoidError("A reason is required to void a vendor bill.");
      return;
    }
    setBusy(true);
    setVoidError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/void`, { reason: voidReason.trim() });
      setBill(updated);
      setVoidOpen(false);
      setVoidReason("");
      showToast("Vendor bill voided", `${updated.billNumber} has been voided and a reversing entry posted.`);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Could not void this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!bill) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/vendor-bills/${bill.id}`);
      router.push("/vendor-bills");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this vendor bill.");
      setBusy(false);
    }
  }

  if (error && !bill) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!bill) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const canEdit = bill.status === "draft";
  const canRecord = bill.status === "draft";
  const canVoid = bill.status === "recorded" && !bill.isOpening;
  const balanceDue = BigInt(bill.balanceDue);
  const amountPaid = BigInt(bill.amountPaid);
  // US-PUR-25: vendor credits used against this bill.
  const credited = BigInt(bill.creditedAmount ?? "0");
  const canRecordPayment = bill.status === "recorded" && balanceDue > 0n;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/vendor-bills")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to vendor bills
      </button>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-on-surface">{bill.billNumber}</h2>
              <Badge className={STATUS_BADGE_CLASS[bill.status]}>{VENDOR_BILL_STATUS_LABELS[bill.status]}</Badge>
              {bill.isOpening && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-on-surface-muted">
              {bill.contactName ?? "Unknown vendor"}
              {bill.dueDate && <> · Due {new Date(bill.dueDate).toLocaleDateString()}</>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HistorySection endpoint={`/vendor-bills/${bill.id}/history`} subjectLabel="this vendor bill" />
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/vendor-bills/${bill.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canRecordPayment && (
              <Button onClick={() => router.push(`/vendor-payments?contactId=${bill.contactId}`)} disabled={busy}>
                Record payment
              </Button>
            )}
            {canRecord && (
              <Button onClick={handleRecord} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Record"}
              </Button>
            )}
            {canVoid && (
              <Button variant="ghost" onClick={() => setVoidOpen(true)} disabled={busy}>
                Void
              </Button>
            )}
            {canManageRecurring && !bill.isOpening && (
              <Button variant="secondary" onClick={() => setRecurringOpen(true)} disabled={busy}>
                Make recurring
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete draft
              </Button>
            )}
          </div>
        </div>

        {bill.status === "void" && bill.voidReason && (
          <Alert variant="warning">
            <AlertDescription>
              Voided{bill.voidedAt && <> on {new Date(bill.voidedAt).toLocaleString()}</>}: {bill.voidReason}
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-on-surface">Lines</h3>
        {bill.isOpening && <p className="text-[13px] text-on-surface-muted">Brought in from your old system, so it has no lines. Attach the original bill below to keep it with this one.</p>}
        <div className="flex flex-col divide-y divide-border">
          {(bill.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className="text-on-surface">{line.name}</p>
                {line.description && <p className="text-[13px] text-on-surface-muted">{line.description}</p>}
                {line.type === "item" && (
                  <p className="text-[12px] text-on-surface-muted">
                    {line.quantity} × {formatMoney(BigInt(line.unitPriceAmount), bill.currency)}
                    {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
                  </p>
                )}
              </div>
              {line.type === "item" && (
                <span className="shrink-0 tabular-nums text-on-surface">
                  {formatMoney(BigInt(line.lineTotalAmount), bill.currency)}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <VendorPaymentsSection billId={bill.id} refreshKey={paymentsRefreshKey} />
      {(bill.creditsApplied ?? []).length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="credits-applied">
          <h2 className="text-[15px] font-semibold text-on-surface">Credits applied</h2>
          {bill.creditsApplied!.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 text-[14px]">
              <a href={`/vendor-credits/${c.vendorCreditId}`} className="text-primary hover:underline">
                {c.number}
                {c.vendorReference ? ` · their ${c.vendorReference}` : ""}
              </a>
              <span className="tabular-nums text-on-surface">{formatMoney(BigInt(c.amount), bill.currency)}</span>
            </div>
          ))}
        </Card>
      )}
      <AttachmentsSection entityType="vendor_bill" entityId={bill.id} />

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <TotalRow label="Subtotal" value={bill.subtotalAmount} currency={bill.currency} />
        <TotalRow label="Tax" value={bill.taxAmount} currency={bill.currency} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={bill.totalAmount} currency={bill.currency} emphasize />
        </div>
        {amountPaid > 0n && (
          <TotalRow label="Paid" value={formatMoney(-(amountPaid), bill.currency)} currency="" raw />
        )}
        {credited > 0n && <TotalRow label="Credits applied" value={formatMoney(-credited, bill.currency)} currency="" raw />}
        {(amountPaid > 0n || credited > 0n) && (
          <div className="border-t border-border pt-2">
            <TotalRow label="Balance due" value={bill.balanceDue} currency={bill.currency} emphasize critical />
          </div>
        )}
      </Card>

      {bill.notes && (
        <Card className="flex flex-col gap-1">
          <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
          <p className="whitespace-pre-wrap text-[13px] text-on-surface">{bill.notes}</p>
        </Card>
      )}

      <RecurringBillDialog
        open={recurringOpen}
        onOpenChange={setRecurringOpen}
        prefill={{
          contactId: bill.contactId,
          currency: bill.currency,
          name: bill.contactName ?? "",
          lines: (bill.lines ?? []).map((l) => ({
            id: l.id,
            sortOrder: l.sortOrder,
            type: l.type,
            catalogItemId: l.catalogItemId,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPriceAmount: l.unitPriceAmount,
            accountId: l.accountId,
            taxRatePercentage: l.taxRatePercentage,
            taxRateId: l.taxRateId,
            taxGroupId: l.taxGroupId,
            isTaxInclusive: l.isTaxInclusive,
          })),
        }}
        onSaved={() => {
          setRecurringOpen(false);
          router.push("/vendor-bills/recurring");
        }}
      />
      {/* Void requires a reason; the API rejects an empty one, so this is a required field, not optional. */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this vendor bill?</DialogTitle>
            <DialogDescription>
              Posts a reversing journal entry and marks {bill.billNumber} as void. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {voidError && (
              <Alert variant="critical">
                <AlertDescription>{voidError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Reason" required>
              {(field) => (
                <Input
                  {...field}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Why is this vendor bill being voided?"
                />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVoidOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleVoid} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Void bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  critical,
}: {
  label: string;
  value: string;
  currency: string;
  emphasize?: boolean;
  raw?: boolean;
  critical?: boolean;
}) {
  const display = raw ? value : formatMoney(BigInt(value), currency);
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasize ? "text-[16px] font-bold" : "text-[14px]"} ${critical ? "text-overdue" : "text-on-surface"}`}
      >
        {display}
      </span>
    </div>
  );
}
