"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { billRecordedToast, owes } from "./vendor-bill-state";
import type { VendorBill } from "./types";

export interface BillRowHandlers {
  /** An action finished: what to tell the person (D-223). */
  onDone: (title: string, description: string) => void;
  /** It didn't: shown above the list. */
  onFailed: (title: string, message: string) => void;
  onPay: (bill: VendorBill) => void;
  onVoid: (bill: VendorBill) => void;
}

/**
 * US-PUR-34 (D-222, D-225) — a bill row's menu: View; Edit and Record for a
 * draft; Pay bill while money is owed; Duplicate; Void (recorded) and
 * Delete (draft), destructive last — each with its icon and right. Record
 * and Delete ask first here; Pay bill and Void open the list's dialogs.
 */
export function VendorBillRowActions({ bill, handlers }: { bill: VendorBill; handlers: BillRowHandlers }) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canEdit = useCanEditOwnership(bill.createdByUserId, { own: "vendor_bills.edit_own", others: "vendor_bills.edit_others" });
  const canDelete = useCanEditOwnership(bill.createdByUserId, { own: "vendor_bills.delete_own", others: "vendor_bills.delete_others" });
  const canRecord = useCapability("vendor_bills.record");
  const canVoid = useCapability("vendor_bills.void");
  const canPay = useCapability("vendor_payments.edit_own");
  const canCreate = useCapability("vendor_bills.edit_own");
  const draft = bill.status === "draft";
  const voidable = bill.status === "recorded" && !bill.isOpening && canVoid;
  const deletable = draft && canDelete;

  async function record() {
    const ok = await confirm({
      title: "Record this bill?",
      description: `${bill.contactName ?? "The vendor"}'s bill ${bill.billNumber} for ${formatMoney(BigInt(bill.totalAmount), bill.currency)} is posted to your books as owed. After that it can't be edited — only voided.`,
      confirmLabel: "Record bill",
    });
    if (!ok) return;
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/record`);
      handlers.onDone(...billRecordedToast({ ...updated, contactName: bill.contactName }));
    } catch (err) {
      handlers.onFailed(`Couldn't record ${bill.billNumber}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Delete this draft bill?", description: `${bill.billNumber} is removed for good. This can't be undone.`, confirmLabel: "Delete draft", danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/vendor-bills/${bill.id}`);
      handlers.onDone("Draft bill deleted", `${bill.billNumber} from ${bill.contactName ?? "the vendor"} has been removed.`);
    } catch (err) {
      handlers.onFailed(`Couldn't delete ${bill.billNumber}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${bill.billNumber}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}`)}>
            <MENU_ICONS.view aria-hidden />
            View
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}/edit`)}>
              <MENU_ICONS.edit aria-hidden />
              Edit
            </DropdownMenuItem>
          )}
          {draft && canRecord && (
            <DropdownMenuItem onSelect={() => void record()}>
              <MENU_ICONS.issue aria-hidden />
              Record
            </DropdownMenuItem>
          )}
          {owes(bill) && canPay && (
            <DropdownMenuItem onSelect={() => handlers.onPay(bill)}>
              <MENU_ICONS.recordPayment aria-hidden />
              Pay bill
            </DropdownMenuItem>
          )}
          {canCreate && !bill.isOpening && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/new?from=${bill.id}`)}>
              <MENU_ICONS.duplicate aria-hidden />
              Duplicate
            </DropdownMenuItem>
          )}
          {(voidable || deletable) && <DropdownMenuSeparator />}
          {voidable && (
            <DropdownMenuItem destructive onSelect={() => handlers.onVoid(bill)}>
              <MENU_ICONS.void aria-hidden />
              Void
            </DropdownMenuItem>
          )}
          {deletable && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
