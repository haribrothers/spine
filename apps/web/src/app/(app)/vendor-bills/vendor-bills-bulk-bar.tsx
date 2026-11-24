"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { FileCheck, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import { describeSkipped } from "../invoices/invoices-bulk-bar";
import type { VendorBill } from "./types";

/**
 * US-PUR-36 (D-225) — the bar over the bills list while rows are ticked:
 * "<n> selected", "Record (<m>)" counting the drafts, and Clear. It asks
 * first with their total (D-218); each records on its own and the toast
 * names any that couldn't be.
 */
export function VendorBillsBulkBar({
  selected,
  onClear,
  onFinished,
  onFailed,
}: {
  selected: VendorBill[];
  onClear: () => void;
  onFinished: (title: string, description: string) => void;
  onFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const drafts = selected.filter((b) => b.status === "draft");
  const currency = drafts[0]?.currency ?? "USD";
  const total = drafts.filter((b) => b.currency === currency).reduce((s, b) => s + BigInt(b.totalAmount), 0n);

  async function record() {
    const names = drafts.length <= 3 ? drafts.map((b) => b.billNumber).join(", ").replace(/, ([^,]*)$/, t("vendorBills.bulkBar.listAnd")) : t("vendorBills.bulkBar.billCount", { count: drafts.length });
    const ok = await confirm({
      title: t("vendorBills.bulkBar.confirmTitle", { count: drafts.length }),
      description: (
        <span data-testid="confirm-record">
          {t("vendorBills.bulkBar.confirmDescription", { count: drafts.length, names, amount: formatMoney(total, currency) })}
        </span>
      ),
      confirmLabel: drafts.length === 1 ? t("vendorBills.bulkBar.recordBill") : t("vendorBills.bulkBar.recordBills"),
      cancelLabel: t("vendorBills.bulkBar.goBack"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/vendor-bills/bulk/record", { ids: drafts.map((b) => b.id) });
      const title = result.done.length ? t("vendorBills.bulkBar.recorded", { count: result.done.length }) : t("vendorBills.bulkBar.noneRecorded");
      onFinished(title, result.skipped.length ? t("vendorBills.bulkBar.skipped", { skipped: describeSkipped(result.skipped) }) : t("vendorBills.bulkBar.postedAsOwed"));
    } catch (err) {
      onFailed(t("vendorBills.bulkBar.recordFailed"), err instanceof Error ? err.message : t("vendorBills.bulkBar.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  const action = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";
  return (
    <div role="region" aria-label={t("vendorBills.bulkBar.region")} className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="bills-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {t("vendorBills.bulkBar.selected", { count: selected.length })}
      </p>
      <Button variant="ghost" size="sm" className={action} disabled={busy || drafts.length === 0} onClick={() => void record()}>
        <FileCheck size={14} aria-hidden />
        {t("vendorBills.bulkBar.record", { count: drafts.length })}
      </Button>
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className={action} onClick={onClear}>
        <X size={14} aria-hidden />
        {t("vendorBills.bulkBar.clear")}
      </Button>
      {dialog}
    </div>
  );
}
