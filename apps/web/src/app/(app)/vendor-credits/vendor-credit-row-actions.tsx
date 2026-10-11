"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { creditRecordedToast, hasCreditLeft } from "./vendor-credit-state";
import type { VendorCredit } from "./types";

export interface CreditRowHandlers {
  /** An action finished: what to tell the person (D-223). */
  onDone: (title: string, description: string) => void;
  /** It didn't: shown above the list. */
  onFailed: (title: string, message: string) => void;
  onApply: (credit: VendorCredit) => void;
  onRefund: (credit: VendorCredit) => void;
  onVoid: (credit: VendorCredit) => void;
}

/** "VCR-0005", or the vendor's own number on a draft. */
export const creditLabel = (credit: Pick<VendorCredit, "number" | "vendorReference">) => credit.number ?? credit.vendorReference ?? "Draft credit";

/**
 * US-PUR-38 (D-222, D-226) — a credit row's menu: View; Edit and Record for
 * a draft; Apply to bills and Record refund while credit is left; Void
 * (recorded) and Delete (draft), destructive last — each with its icon and
 * right. Record and Delete ask first here; the rest open the list's dialogs.
 */
export function VendorCreditRowActions({ credit, handlers }: { credit: VendorCredit; handlers: CreditRowHandlers }) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canEdit = useCanEditOwnership(credit.createdByUserId, { own: "vendor_credits.edit_own", others: "vendor_credits.edit_others" });
  const canDelete = useCanEditOwnership(credit.createdByUserId, { own: "vendor_credits.delete_own", others: "vendor_credits.delete_others" });
  const canRecord = useCapability("vendor_credits.record");
  const canApply = useCapability("vendor_credits.apply");
  const canVoid = useCapability("vendor_credits.void");
  const draft = credit.status === "draft";
  const left = hasCreditLeft(credit);
  const voidable = (credit.status === "open" || credit.status === "used") && !credit.isOpening && canVoid;
  const deletable = draft && canDelete;
  const vendor = credit.contactName ?? "the vendor";
  const label = creditLabel(credit);

  async function record() {
    const ok = await confirm({
      title: "Record this vendor credit?",
      description: `${formatMoney(BigInt(credit.totalAmount), credit.currency)} from ${vendor} is posted to your books, lowering what you owe them. After that it can't be edited — only voided.`,
      confirmLabel: "Record credit",
    });
    if (!ok) return;
    try {
      const updated = await apiClient.post<VendorCredit>(`/vendor-credits/${credit.id}/record`);
      handlers.onDone(...creditRecordedToast({ ...updated, contactName: credit.contactName }));
    } catch (err) {
      handlers.onFailed(`Couldn't record ${label}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Delete this draft credit?", description: `${vendor}'s credit note ${label} is removed for good. This can't be undone.`, confirmLabel: "Delete draft", danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/vendor-credits/${credit.id}`);
      handlers.onDone("Draft credit deleted", `${vendor}'s credit note ${label} has been removed.`);
    } catch (err) {
      handlers.onFailed(`Couldn't delete ${label}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${label}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/vendor-credits/${credit.id}`)}>
            <MENU_ICONS.view aria-hidden />
            View
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-credits/${credit.id}/edit`)}>
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
          {left && canApply && (
            <DropdownMenuItem onSelect={() => handlers.onApply(credit)}>
              <MENU_ICONS.applyCredit aria-hidden />
              Apply to bills
            </DropdownMenuItem>
          )}
          {left && canApply && (
            <DropdownMenuItem onSelect={() => handlers.onRefund(credit)}>
              <MENU_ICONS.refund aria-hidden />
              Record refund
            </DropdownMenuItem>
          )}
          {(voidable || deletable) && <DropdownMenuSeparator />}
          {voidable && (
            <DropdownMenuItem destructive onSelect={() => handlers.onVoid(credit)}>
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
