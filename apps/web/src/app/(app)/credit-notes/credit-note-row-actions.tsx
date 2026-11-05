"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { MENU_ICONS } from "../../../lib/menu-icons";
import type { CreditNoteRow } from "./types";
import { useT } from "../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-INV-40 (D-219) — a credit note row's menu: View, Apply credit and
 * Refund while credit is left, Email credit note and Download PDF, each
 * only with the right to do it. Apply, Refund and Email open the credit
 * note's page with that dialog (`?action=`), so nothing is applied,
 * refunded or emailed from one click (D-218).
 */
export function CreditNoteRowActions({ note }: { note: CreditNoteRow }) {
  const t = useT();
  const router = useRouter();
  const canApply = useCapability("payments.apply_credit");
  const canRefund = useCapability("payments.refund");
  const canSend = useCapability("invoices.send");
  const issued = note.status === "issued";
  const left = BigInt(note.creditRemainingAmount ?? "0") > 0n;
  const open = (action?: string) => router.push(`/credit-notes/${note.id}${action ? `?action=${action}` : ""}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("creditNotes.rowActions.actionsFor", { number: note.number ?? t("creditNotes.rowActions.thisDraft") })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => open()}>
          <MENU_ICONS.view aria-hidden />
          {t("creditNotes.rowActions.view")}
        </DropdownMenuItem>
        {issued && left && canApply && (
          <DropdownMenuItem onSelect={() => open("apply")}>
            <MENU_ICONS.applyCredit aria-hidden />
            {t("creditNotes.rowActions.applyCredit")}
          </DropdownMenuItem>
        )}
        {issued && left && canRefund && (
          <DropdownMenuItem onSelect={() => open("refund")}>
            <MENU_ICONS.refund aria-hidden />
            {t("creditNotes.rowActions.refund")}
          </DropdownMenuItem>
        )}
        {issued && canSend && (
          <DropdownMenuItem onSelect={() => open("email")}>
            <MENU_ICONS.email aria-hidden />
            {t("creditNotes.rowActions.email")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={`${API_URL}/credit-notes/${note.id}/pdf`} target="_blank" rel="noreferrer">
            <MENU_ICONS.download aria-hidden />
            {issued ? t("creditNotes.rowActions.downloadPdf") : t("creditNotes.rowActions.previewPdf")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
