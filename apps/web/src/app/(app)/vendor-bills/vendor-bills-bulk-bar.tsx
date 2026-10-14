"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { FileCheck, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
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
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const drafts = selected.filter((b) => b.status === "draft");
  const currency = drafts[0]?.currency ?? "USD";
  const total = drafts.filter((b) => b.currency === currency).reduce((s, b) => s + BigInt(b.totalAmount), 0n);

  async function record() {
    const names = drafts.length <= 3 ? drafts.map((b) => b.billNumber).join(", ").replace(/, ([^,]*)$/, " and $1") : `${drafts.length} bills`;
    const ok = await confirm({
      title: `Record ${drafts.length} ${drafts.length === 1 ? "bill" : "bills"}?`,
      description: (
        <span data-testid="confirm-record">
          {names} — {formatMoney(total, currency)} in all — {drafts.length === 1 ? "is" : "are"} posted to your books as owed. After that {drafts.length === 1 ? "it" : "they"} can&apos;t be edited, only voided.
        </span>
      ),
      confirmLabel: drafts.length === 1 ? "Record bill" : "Record bills",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/vendor-bills/bulk/record", { ids: drafts.map((b) => b.id) });
      const title = result.done.length ? `${result.done.length} ${result.done.length === 1 ? "bill" : "bills"} recorded` : "No bills recorded";
      onFinished(title, result.skipped.length ? `Skipped — ${describeSkipped(result.skipped)}` : "They're posted to your books as owed.");
    } catch (err) {
      onFailed("Couldn't record the bills.", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  const action = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";
  return (
    <div role="region" aria-label="Selected bills" className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="bills-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {selected.length} selected
      </p>
      <Button variant="ghost" size="sm" className={action} disabled={busy || drafts.length === 0} onClick={() => void record()}>
        <FileCheck size={14} aria-hidden />
        Record ({drafts.length})
      </Button>
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className={action} onClick={onClear}>
        <X size={14} aria-hidden />
        Clear
      </Button>
      {dialog}
    </div>
  );
}
