"use client";

import { Button } from "@spine/ui";
import { X } from "lucide-react";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { payBlocked } from "./payables-list-state";
import type { PayablesBillRow } from "./types";

/**
 * US-PUR-58 — the bar over "By bill" while bills are ticked: "<n>
 * selected", "Pay (<n>)" and Clear. Pay opens the vendor payment dialog
 * with the bills ticked (it asks before recording); bills from several
 * vendors can't be paid together, and the bar says why.
 */
export function PayablesBulkBar({ selected, onPay, onClear }: { selected: PayablesBillRow[]; onPay: () => void; onClear: () => void }) {
  const blocked = payBlocked(selected);
  const tone = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";
  return (
    <div role="region" aria-label="Selected bills" className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="payables-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {selected.length} selected
      </p>
      <Button variant="ghost" size="sm" className={tone} disabled={Boolean(blocked)} aria-describedby={blocked ? "payables-pay-blocked" : undefined} onClick={onPay}>
        <MENU_ICONS.recordPayment size={14} aria-hidden />
        Pay ({selected.length})
      </Button>
      {blocked && (
        <span id="payables-pay-blocked" className="text-[12.5px] text-inverse-on-surface/80">
          {blocked}
        </span>
      )}
      <span className="flex-1" />
      <Button variant="ghost" size="sm" className={tone} onClick={onClear}>
        <X size={14} aria-hidden />
        Clear
      </Button>
    </div>
  );
}
