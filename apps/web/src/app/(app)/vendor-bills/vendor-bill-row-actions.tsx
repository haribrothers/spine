"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { VendorBill } from "./types";

/**
 * Row-level "more" menu, mirroring invoices/invoice-row-actions.tsx exactly.
 * "Edit"/"Delete" only appear for a draft — a recorded/void bill is
 * immutable (VendorBillsService.update/delete's own guards) — AND with
 * `vendor_bills.edit_own`/`edit_others`/`delete_own`/`delete_others` (own
 * vs. others from `bill.createdByUserId`). "Record" only appears for a
 * draft (the posting action) AND with `vendor_bills.record`; "Void" only
 * for a recorded bill AND with `vendor_bills.void` — both dedicated,
 * non-ownership capabilities (recording/voiding isn't an "edit" of the
 * creator's own record).
 */
export function VendorBillRowActions({
  bill,
  onDeleted,
  onRecorded,
}: {
  bill: VendorBill;
  onDeleted: (bill: VendorBill) => void;
  onRecorded?: (bill: VendorBill) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const canEdit = useCanEditOwnership(bill.createdByUserId, { own: "vendor_bills.edit_own", others: "vendor_bills.edit_others" });
  const canDelete = useCanEditOwnership(bill.createdByUserId, { own: "vendor_bills.delete_own", others: "vendor_bills.delete_others" });
  const canRecord = useCapability("vendor_bills.record");
  const canVoid = useCapability("vendor_bills.void");

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/vendor-bills/${bill.id}`);
      setConfirmOpen(false);
      onDeleted(bill);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecord() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/record`);
      onRecorded?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    if (!voidReason.trim()) {
      setVoidError("A reason is required to void a vendor bill.");
      return;
    }
    setBusy(true);
    setVoidError(null);
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/void`, { reason: voidReason.trim() });
      setVoidOpen(false);
      setVoidReason("");
      onRecorded?.(updated);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Could not void this vendor bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${bill.billNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}`)}>View</DropdownMenuItem>
          {bill.status === "draft" && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {bill.status === "draft" && canRecord && (
            <DropdownMenuItem disabled={busy} onSelect={handleRecord}>
              Record
            </DropdownMenuItem>
          )}
          {bill.status === "recorded" && canVoid && (
            <DropdownMenuItem onSelect={() => setVoidOpen(true)}>Void</DropdownMenuItem>
          )}
          {bill.status === "draft" && canDelete && (
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft vendor bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft. This cannot be undone.
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this vendor bill?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex flex-col gap-3 pt-2 text-left">
                <p>Posts a reversing journal entry and marks {bill.billNumber} as void. This cannot be undone.</p>
                <Input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Why is this vendor bill being voided?"
                />
                {voidError && <span className="text-overdue">{voidError}</span>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVoidReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleVoid}>
              Void bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
