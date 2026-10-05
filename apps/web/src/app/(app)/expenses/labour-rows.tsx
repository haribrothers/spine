"use client";

import { useId } from "react";
import { Button, Input, MoneyInput } from "@spine/ui";
import { labourTotal } from "@spine/shared";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "../../../lib/money";

export interface LabourRow {
  key: string;
  trade: string;
  /** As typed, so the field can be blank while editing. */
  headcount: string;
  dayRateAmount: bigint;
}

let seq = 0;
export function blankLabourRow(): LabourRow {
  seq += 1;
  return { key: `labour-${Date.now()}-${seq}`, trade: "", headcount: "", dayRateAmount: 0n };
}

/** Whole workers, or 0 when the field isn't a whole number yet. */
export function headcountOf(row: LabourRow): number {
  const n = Number(row.headcount);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function rowsTotal(rows: LabourRow[]): bigint {
  return labourTotal(rows.map((r) => ({ headcount: headcountOf(r), dayRateAmount: r.dayRateAmount })));
}

/**
 * US-PUR-23 (D-126) — a day's labour as trade × workers × day rate, with
 * each row's total and the day's total. A trade used before is suggested
 * and fills in its last day rate. Never names, attendance or hours.
 */
export function LabourRows({
  rows,
  onChange,
  currency,
  trades,
}: {
  rows: LabourRow[];
  onChange: (rows: LabourRow[]) => void;
  currency: string;
  /** Trades used before and their last day rate (`GET /expenses/labour-trades`). */
  trades: { trade: string; lastDayRateAmount: string }[];
}) {
  const listId = useId();
  const workers = rows.reduce((sum, r) => sum + headcountOf(r), 0);

  function update(key: string, patch: Partial<LabourRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function changeTrade(row: LabourRow, trade: string) {
    const known = trades.find((t) => t.trade.toLowerCase() === trade.trim().toLowerCase());
    // A trade used before brings its last day rate, unless one's already entered.
    update(row.key, { trade, ...(known && row.dayRateAmount === 0n ? { dayRateAmount: BigInt(known.lastDayRateAmount) } : {}) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <datalist id={listId}>
        {trades.map((t) => (
          <option key={t.trade} value={t.trade} />
        ))}
      </datalist>
      <div className="grid grid-cols-[1fr_5rem_8rem_7rem_2rem] gap-2 text-[12px] font-medium text-on-surface-muted" aria-hidden>
        <span>Trade</span>
        <span className="text-right">Workers</span>
        <span className="text-right">Day rate</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={row.key} className="grid grid-cols-[1fr_5rem_8rem_7rem_2rem] items-center gap-2">
          <Input aria-label={`Trade ${i + 1}`} list={listId} value={row.trade} placeholder="e.g. Mason" onChange={(e) => changeTrade(row, e.target.value)} />
          <Input aria-label={`Workers ${i + 1}`} inputMode="numeric" className="text-right tabular-nums" value={row.headcount} onChange={(e) => update(row.key, { headcount: e.target.value })} />
          <MoneyInput aria-label={`Day rate ${i + 1}`} value={row.dayRateAmount} currency={currency} onValueChange={(dayRateAmount) => update(row.key, { dayRateAmount })} />
          <span className="text-right text-[14px] tabular-nums text-on-surface">{formatMoney(BigInt(headcountOf(row)) * row.dayRateAmount, currency)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove trade ${i + 1}`}
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, blankLabourRow()])} disabled={rows.length >= 20}>
          <Plus size={14} aria-hidden /> Add trade
        </Button>
        <div className="text-right">
          <p className="text-[12px] text-on-surface-muted">
            Total for the day · {workers} {workers === 1 ? "worker" : "workers"}
          </p>
          <p className="text-[18px] font-semibold tabular-nums text-on-surface" aria-live="polite">
            {formatMoney(rowsTotal(rows), currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
