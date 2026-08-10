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
import type { VendorBill } from "./types";

/**
 * Row-level "more" menu, mirroring invoices/invoice-row-actions.tsx exactly.
 * "Edit"/"Delete" only appear for a draft — a recorded/void bill is
 * immutable (VendorBillsService.update/delete's own guards). "Record" only
 * appears for a draft (the posting action), "Void" only for a recorded bill
 * (requires a reason, mirroring S-05.8's void flow) — same conditional
 * pattern as invoice-row-actions.tsx, minus the send-reminder action (no
 * such story for vendor bills).
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
          {bill.status === "draft" && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {bill.status === "draft" && (
            <DropdownMenuItem disabled={busy} onSelect={handleRecord}>
              Record
            </DropdownMenuItem>
          )}
          {bill.status === "recorded" && (
            <DropdownMenuItem onSelect={() => setVoidOpen(true)}>Void</DropdownMenuItem>
          )}
          {bill.status === "draft" && (
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
            <AlertDialogAction disabled={busy} onClick={handleDelete}>
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
            <AlertDialogAction disabled={busy} onClick={handleVoid}>
              Void bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
