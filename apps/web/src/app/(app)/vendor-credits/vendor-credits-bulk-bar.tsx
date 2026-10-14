"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { FileCheck, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
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
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const drafts = selected.filter((c) => c.status === "draft");
  const currency = drafts[0]?.currency ?? "USD";
  const total = drafts.filter((c) => c.currency === currency).reduce((s, c) => s + BigInt(c.totalAmount), 0n);
  const plural = (n: number) => `${n} vendor ${n === 1 ? "credit" : "credits"}`;

  async function record() {
    const names =
      drafts.length <= 3
        ? drafts
            .map((c) => `${c.contactName ?? "the vendor"}’s ${c.vendorReference ?? "credit"}`)
            .join(", ")
            .replace(/, ([^,]*)$/, " and $1")
        : plural(drafts.length);
    const ok = await confirm({
      title: `Record ${plural(drafts.length)}?`,
      description: (
        <span data-testid="confirm-record">
          {names} — {formatMoney(total, currency)} in all — {drafts.length === 1 ? "is" : "are"} posted to your books, lowering what you owe. After that {drafts.length === 1 ? "it" : "they"} can&apos;t be edited, only voided.
        </span>
      ),
      confirmLabel: drafts.length === 1 ? "Record credit" : "Record credits",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/vendor-credits/bulk/record", { ids: drafts.map((c) => c.id) });
      const title = result.done.length ? `${plural(result.done.length)} recorded` : "No vendor credits recorded";
      onFinished(title, result.skipped.length ? `Skipped — ${describeSkipped(result.skipped)}` : "They're off what you owe your vendors.");
    } catch (err) {
      onFailed("Couldn't record the credits.", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  const action = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";
  return (
    <div role="region" aria-label="Selected credits" className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="credits-bulk-bar">
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
