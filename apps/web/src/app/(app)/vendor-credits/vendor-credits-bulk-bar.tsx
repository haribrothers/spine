"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { FileCheck, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import { describeSkipped } from "../invoices/invoices-bulk-bar";
import type { VendorCredit } from "./types";

/**
 * US-PUR-41 (D-226) — the bar over the credits list while rows are ticked:
 * "<n> selected", "Record (<m>)" counting the drafts, and Clear. It asks
 * first with their total (D-218); each records on its own and the toast
 * names any that couldn't be.
 */
export function VendorCreditsBulkBar({
  selected,
  onClear,
  onFinished,
  onFailed,
}: {
  selected: VendorCredit[];
  onClear: () => void;
  onFinished: (title: string, description: string) => void;
  onFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const drafts = selected.filter((c) => c.status === "draft");
  const currency = drafts[0]?.currency ?? "USD";
  const total = drafts.filter((c) => c.currency === currency).reduce((s, c) => s + BigInt(c.totalAmount), 0n);
  const plural = (n: number) => t("vendorCredits.bulkBar.vendorCredits", { count: n });

  async function record() {
    const names =
      drafts.length <= 3
        ? drafts
            .map((c) => t("vendorCredits.bulkBar.creditName", { vendor: c.contactName ?? t("vendorCredits.bulkBar.theVendor"), reference: c.vendorReference ?? t("vendorCredits.bulkBar.credit") }))
            .join(", ")
            .replace(/, ([^,]*)$/, t("vendorCredits.bulkBar.listAnd"))
        : plural(drafts.length);
    const ok = await confirm({
      title: t("vendorCredits.bulkBar.confirmTitle", { credits: plural(drafts.length) }),
      description: (
        <span data-testid="confirm-record">
          {t("vendorCredits.bulkBar.confirmDescription", { count: drafts.length, names, amount: formatMoney(total, currency) })}
        </span>
      ),
      confirmLabel: drafts.length === 1 ? t("vendorCredits.bulkBar.recordCredit") : t("vendorCredits.bulkBar.recordCredits"),
      cancelLabel: t("vendorCredits.bulkBar.goBack"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/vendor-credits/bulk/record", { ids: drafts.map((c) => c.id) });
      const title = result.done.length ? t("vendorCredits.bulkBar.recorded", { credits: plural(result.done.length) }) : t("vendorCredits.bulkBar.noneRecorded");
      onFinished(title, result.skipped.length ? t("vendorCredits.bulkBar.skipped", { skipped: describeSkipped(result.skipped) }) : t("vendorCredits.bulkBar.offWhatYouOwe"));
    } catch (err) {
      onFailed(t("vendorCredits.bulkBar.recordFailed"), err instanceof Error ? err.message : t("vendorCredits.bulkBar.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  const action = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";
  return (
    <div role="region" aria-label={t("vendorCredits.bulkBar.region")} className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="credits-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {t("vendorCredits.bulkBar.selected", { count: selected.length })}
      </p>
      <Button variant="ghost" size="sm" className={action} disabled={busy || drafts.length === 0} onClick={() => void record()}>
        <FileCheck size={14} aria-hidden />
        {t("vendorCredits.bulkBar.record", { count: drafts.length })}
      </Button>
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className={action} onClick={onClear}>
        <X size={14} aria-hidden />
        {t("vendorCredits.bulkBar.clear")}
      </Button>
      {dialog}
    </div>
  );
}
