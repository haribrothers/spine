"use client";

import { useState } from "react";
import { ChevronUp, Ellipsis } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, cn, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@spine/ui";
import { formatMoney } from "../lib/money";
import { useT } from "../lib/i18n";
import { useIsPhone } from "../lib/use-is-phone";

/**
 * US-QUO-35, US-INV-34 — the bar at the bottom of a document builder: the
 * totals, "Unsaved changes", and the builder's buttons, kept in view while
 * the lines scroll. `testIdPrefix` names it per document ("quote",
 * "invoice").
 *
 * US-OPS-59: under 768px it's a slim bar along the bottom of the screen — the total (tap it for
 * the subtotal and tax), ⋯ with `phoneMore` (Save as draft, Preview PDF) and `phoneMain` (Save and
 * send, Issue). Cancel is the top bar's. It steps aside while the keyboard is up.
 */
export function DocumentBuilderBar({
  totals,
  currency,
  taxLabel: taxLabelProp,
  dirty,
  testIdPrefix,
  children,
  phoneMain,
  phoneMore,
}: {
  totals: { subtotal: bigint; tax: bigint; total: bigint };
  currency: string;
  taxLabel?: string;
  dirty: boolean;
  testIdPrefix: string;
  children: React.ReactNode;
  /** On a phone: the main button (Save and send, Issue). */
  phoneMain?: React.ReactNode;
  /** On a phone: `DropdownMenuItem`s under ⋯ (Save as draft, Preview PDF). */
  phoneMore?: React.ReactNode;
}) {
  const t = useT();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const taxLabel = taxLabelProp ?? t("invoices.builderBar.tax");
  const row = (key: "subtotal" | "tax" | "total", label: string, value: bigint, emphasize = false) => (
    <div className="flex flex-col">
      <dt className="text-[12px] text-on-surface-muted">{label}</dt>
      <dd className={cn("tabular-nums text-on-surface", emphasize ? "text-[17px] font-bold" : "text-[13.5px] font-medium")} data-testid={`${testIdPrefix}-total-${key}`}>
        {formatMoney(value, currency)}
      </dd>
    </div>
  );
  const subtotalRow = row("subtotal", t("invoices.builderBar.subtotal"), totals.subtotal);
  const taxRow = row("tax", taxLabel, totals.tax);
  const totalRow = row("total", t("invoices.builderBar.total"), totals.total, true);
  if (phone && phoneMain) {
    return (
      <div
        className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col border-t border-border bg-surface px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_20px_rgba(0,0,0,0.06)]"
        data-builder-bar=""
        data-testid={`${testIdPrefix}-builder-bar`}
      >
        {open && (
          <dl className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border pb-2 text-[13.5px]" id={`${testIdPrefix}-builder-totals`}>
            <dt className="text-on-surface-muted">{t("invoices.builderBar.subtotal")}</dt>
            <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-total-subtotal`}>
              {formatMoney(totals.subtotal, currency)}
            </dd>
            <dt className="text-on-surface-muted">{taxLabel}</dt>
            <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-total-tax`}>
              {formatMoney(totals.tax, currency)}
            </dd>
          </dl>
        )}
        <div className="flex items-center gap-2">
          <button type="button" aria-expanded={open} aria-controls={`${testIdPrefix}-builder-totals`} onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 flex-col items-start rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="flex items-center gap-1 text-[12px] text-on-surface-muted">
              {t("invoices.builderBar.total")}
              <ChevronUp size={13} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
              {dirty && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-due-soon" aria-label={t("invoices.builderBar.unsaved")} role="img" data-testid={`${testIdPrefix}-unsaved`} />}
            </span>
            <span className="truncate text-[17px] font-bold tabular-nums text-on-surface" data-testid={`${testIdPrefix}-total-total`}>
              {formatMoney(totals.total, currency)}
            </span>
          </button>
          {phoneMore && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={t("common.phone.moreActions.open")}>
                  <Ellipsis size={20} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">{phoneMore}</DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="shrink-0 [&>*]:h-11">{phoneMain}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-5 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)]" data-testid={`${testIdPrefix}-builder-bar`}>
      <dl className="flex gap-6">
        {subtotalRow}
        {taxRow}
        {totalRow}
      </dl>
      <span className="flex-1" />
      {dirty && (
        <span className="flex items-center gap-1.5 text-[12px] text-on-surface-muted" data-testid={`${testIdPrefix}-unsaved`}>
          <span className="h-1.5 w-1.5 rounded-full bg-due-soon" aria-hidden />
          {t("invoices.builderBar.unsaved")}
        </span>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** "Leave without saving?" — Leave, or Keep editing (focused). */
export function LeaveWithoutSavingDialog({ open, document, onLeave, onStay }: { open: boolean; document: string; onLeave: () => void; onStay: () => void }) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("invoices.builderBar.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("invoices.builderBar.leaveDescription", { document })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="secondary" onClick={onLeave}>
            {t("invoices.builderBar.leave")}
          </Button>
          <Button onClick={onStay} autoFocus>
            {t("invoices.builderBar.keepEditing")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
