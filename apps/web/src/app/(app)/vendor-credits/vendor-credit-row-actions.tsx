"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { t as translate, useT } from "../../../lib/i18n";
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
export const creditLabel = (credit: Pick<VendorCredit, "number" | "vendorReference">) => credit.number ?? credit.vendorReference ?? translate("vendorCredits.rowActions.draftCredit");

/**
 * US-PUR-38 (D-222, D-226) — a credit row's menu: View; Edit and Record for
 * a draft; Apply to bills and Record refund while credit is left; Void
 * (recorded) and Delete (draft), destructive last — each with its icon and
 * right. Record and Delete ask first here; the rest open the list's dialogs.
 */
export function VendorCreditRowActions({ credit, handlers }: { credit: VendorCredit; handlers: CreditRowHandlers }) {
  const t = useT();
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
  const vendor = credit.contactName ?? t("vendorCredits.rowActions.theVendor");
  const label = creditLabel(credit);

  async function record() {
    const ok = await confirm({
      title: t("vendorCredits.recordConfirm.title"),
      description: t("vendorCredits.recordConfirm.description", { amount: formatMoney(BigInt(credit.totalAmount), credit.currency), vendor }),
      confirmLabel: t("vendorCredits.recordConfirm.confirmLabel"),
    });
    if (!ok) return;
    try {
      const updated = await apiClient.post<VendorCredit>(`/vendor-credits/${credit.id}/record`);
      handlers.onDone(...creditRecordedToast({ ...updated, contactName: credit.contactName }));
    } catch (err) {
      handlers.onFailed(t("vendorCredits.rowActions.recordFailed", { label }), err instanceof Error ? err.message : t("vendorCredits.rowActions.tryAgain"));
    }
  }

  async function remove() {
    const ok = await confirm({
      title: t("vendorCredits.deleteConfirm.title"),
      description: t("vendorCredits.deleteConfirm.description", { vendor, reference: label }),
      confirmLabel: t("vendorCredits.deleteConfirm.confirmLabel"),
      danger: true,
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/vendor-credits/${credit.id}`);
      handlers.onDone(t("vendorCredits.deleteConfirm.deletedTitle"), t("vendorCredits.deleteConfirm.deletedDescription", { vendor, reference: label }));
    } catch (err) {
      handlers.onFailed(t("vendorCredits.rowActions.deleteFailed", { label }), err instanceof Error ? err.message : t("vendorCredits.rowActions.tryAgain"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("vendorCredits.rowActions.actionsFor", { label })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/vendor-credits/${credit.id}`)}>
            <MENU_ICONS.view aria-hidden />
            {t("vendorCredits.rowActions.view")}
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/vendor-credits/${credit.id}/edit`)}>
              <MENU_ICONS.edit aria-hidden />
              {t("vendorCredits.rowActions.edit")}
            </DropdownMenuItem>
          )}
          {draft && canRecord && (
            <DropdownMenuItem onSelect={() => void record()}>
              <MENU_ICONS.issue aria-hidden />
              {t("vendorCredits.rowActions.record")}
            </DropdownMenuItem>
          )}
          {left && canApply && (
            <DropdownMenuItem onSelect={() => handlers.onApply(credit)}>
              <MENU_ICONS.applyCredit aria-hidden />
              {t("vendorCredits.rowActions.applyToBills")}
            </DropdownMenuItem>
          )}
          {left && canApply && (
            <DropdownMenuItem onSelect={() => handlers.onRefund(credit)}>
              <MENU_ICONS.refund aria-hidden />
              {t("vendorCredits.rowActions.recordRefund")}
            </DropdownMenuItem>
          )}
          {(voidable || deletable) && <DropdownMenuSeparator />}
          {voidable && (
            <DropdownMenuItem destructive onSelect={() => handlers.onVoid(credit)}>
              <MENU_ICONS.void aria-hidden />
              {t("vendorCredits.rowActions.void")}
            </DropdownMenuItem>
          )}
          {deletable && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              {t("vendorCredits.rowActions.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
