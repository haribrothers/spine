"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { useT } from "../../../lib/i18n";
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
  const t = useT();
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
      title: t("vendorBills.recordConfirm.title"),
      description: t("vendorBills.recordConfirm.description", {
        vendor: bill.contactName ?? t("vendorBills.recordConfirm.theVendor"),
        number: bill.billNumber,
        amount: formatMoney(BigInt(bill.totalAmount), bill.currency),
      }),
      confirmLabel: t("vendorBills.recordConfirm.confirmLabel"),
    });
    if (!ok) return;
    try {
      const updated = await apiClient.post<VendorBill>(`/vendor-bills/${bill.id}/record`);
      handlers.onDone(...billRecordedToast({ ...updated, contactName: bill.contactName }));
    } catch (err) {
      handlers.onFailed(t("vendorBills.rowActions.recordFailed", { number: bill.billNumber }), err instanceof Error ? err.message : t("vendorBills.rowActions.tryAgain"));
    }
  }

  async function remove() {
    const ok = await confirm({
      title: t("vendorBills.deleteConfirm.title"),
      description: t("vendorBills.deleteConfirm.description", { number: bill.billNumber }),
      confirmLabel: t("vendorBills.deleteConfirm.confirmLabel"),
      danger: true,
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/vendor-bills/${bill.id}`);
      handlers.onDone(t("vendorBills.deleteConfirm.deletedTitle"), t("vendorBills.deleteConfirm.deletedDescription", { number: bill.billNumber, vendor: bill.contactName ?? t("vendorBills.deleteConfirm.theVendor") }));
    } catch (err) {
      handlers.onFailed(t("vendorBills.rowActions.deleteFailed", { number: bill.billNumber }), err instanceof Error ? err.message : t("vendorBills.rowActions.tryAgain"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("vendorBills.rowActions.actionsFor", { number: bill.billNumber })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}`)}>
            <MENU_ICONS.view aria-hidden />
            {t("vendorBills.rowActions.view")}
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${bill.id}/edit`)}>
              <MENU_ICONS.edit aria-hidden />
              {t("vendorBills.rowActions.edit")}
            </DropdownMenuItem>
          )}
          {draft && canRecord && (
            <DropdownMenuItem onSelect={() => void record()}>
              <MENU_ICONS.issue aria-hidden />
              {t("vendorBills.rowActions.record")}
            </DropdownMenuItem>
          )}
          {owes(bill) && canPay && (
            <DropdownMenuItem onSelect={() => handlers.onPay(bill)}>
              <MENU_ICONS.recordPayment aria-hidden />
              {t("vendorBills.rowActions.payBill")}
            </DropdownMenuItem>
          )}
          {canCreate && !bill.isOpening && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/new?from=${bill.id}`)}>
              <MENU_ICONS.duplicate aria-hidden />
              {t("vendorBills.rowActions.duplicate")}
            </DropdownMenuItem>
          )}
          {(voidable || deletable) && <DropdownMenuSeparator />}
          {voidable && (
            <DropdownMenuItem destructive onSelect={() => handlers.onVoid(bill)}>
              <MENU_ICONS.void aria-hidden />
              {t("vendorBills.rowActions.void")}
            </DropdownMenuItem>
          )}
          {deletable && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              {t("vendorBills.rowActions.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
