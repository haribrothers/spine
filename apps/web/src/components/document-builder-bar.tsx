"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, cn } from "@spine/ui";
import { formatMoney } from "../lib/money";
import { useT } from "../lib/i18n";

/**
 * US-QUO-35, US-INV-34 — the bar at the bottom of a document builder: the
 * totals, "Unsaved changes", and the builder's buttons, kept in view while
 * the lines scroll. `testIdPrefix` names it per document ("quote",
 * "invoice").
 */
export function DocumentBuilderBar({
  totals,
  currency,
  taxLabel: taxLabelProp,
  dirty,
  testIdPrefix,
  children,
}: {
  totals: { subtotal: bigint; tax: bigint; total: bigint };
  currency: string;
  taxLabel?: string;
  dirty: boolean;
  testIdPrefix: string;
  children: React.ReactNode;
}) {
  const t = useT();
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
