"use client";

import { SUPPLY_CLASS_LABELS } from "@spine/shared";
import { Card, cn } from "@spine/ui";
import { formatMoney } from "../../../lib/money";
import type { Quote } from "./types";

/**
 * US-QUO-31 (D-214) — a quote's lines as a table: Item (with its
 * description), Qty, Rate, Discount and Tax (only when any line has them)
 * and Amount; headings span the row in bold, text lines in muted text.
 * Totals sit under it — Discount only when there is one, and the tax by
 * name (CGST and SGST on a GST quote) as on the PDF.
 */
export function QuoteLinesTable({ quote }: { quote: Quote & { taxLines?: { label: string; amount: string }[] } }) {
  const lines = (quote.lines ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const items = lines.filter((l) => l.type === "item");
  const showDiscount = items.some((l) => l.discountPercentage > 0);
  const showTax = items.some((l) => l.taxRatePercentage > 0);
  const money = (v: string) => formatMoney(BigInt(v), quote.currency);
  const cols = 3 + (showDiscount ? 1 : 0) + (showTax ? 1 : 0);
  const discount = BigInt(quote.discountAmount);
  const taxLines = quote.taxLines?.length ? quote.taxLines : [{ label: "Tax", amount: quote.taxAmount }];

  return (
    <Card className="overflow-hidden p-0" data-testid="quote-lines">
      <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Lines</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-surface-sunken text-left text-[12px] font-medium text-on-surface-muted">
              <th scope="col" className="px-4 py-2 font-medium">Item</th>
              <th scope="col" className="w-20 px-2 py-2 text-right font-medium">Qty</th>
              <th scope="col" className="w-28 px-2 py-2 text-right font-medium">Rate</th>
              {showDiscount && <th scope="col" className="w-16 px-2 py-2 text-right font-medium">Disc.</th>}
              {showTax && <th scope="col" className="w-16 px-2 py-2 text-right font-medium">Tax</th>}
              <th scope="col" className="w-32 px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) =>
              line.type === "item" ? (
                <tr key={line.id} className="border-t border-border align-top">
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-on-surface">{line.name}</span>
                    {line.description && <span className="mt-0.5 block text-[12.5px] text-on-surface-muted">{line.description}</span>}
                    {/* US-TAX-11: the supply type snapshotted on the line — on a GST quote (elsewhere "zero-rated" is just untaxed, D-213). */}
                    {quote.placeOfSupply && line.supplyClass && line.supplyClass !== "taxable" && <span className="mt-0.5 block text-[12px] text-on-surface-muted">{SUPPLY_CLASS_LABELS[line.supplyClass]}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{line.quantity}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(line.unitPriceAmount)}</td>
                  {showDiscount && <td className="px-2 py-2.5 text-right tabular-nums">{line.discountPercentage > 0 ? `${line.discountPercentage}%` : "—"}</td>}
                  {showTax && <td className="px-2 py-2.5 text-right tabular-nums">{line.taxRatePercentage > 0 ? `${line.taxRatePercentage}%` : "—"}</td>}
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(line.lineTotalAmount)}</td>
                </tr>
              ) : (
                <tr key={line.id} className={cn("border-t border-border", line.type === "heading" && "bg-surface-sunken/60")}>
                  <td colSpan={cols + 1} className={cn("px-4 py-2", line.type === "heading" ? "font-semibold text-on-surface" : "text-[13px] text-on-surface-muted")}>
                    {line.name}
                    {line.description && <span className="block text-[12.5px] font-normal text-on-surface-muted">{line.description}</span>}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-[13px]" data-testid="quote-totals">
        <dt className="text-on-surface-muted">Subtotal</dt>
        <dd className="text-right tabular-nums">{money(quote.subtotalAmount)}</dd>
        {discount > 0n && (
          <>
            <dt className="text-on-surface-muted">Discount</dt>
            <dd className="text-right tabular-nums">{formatMoney(-discount, quote.currency)}</dd>
          </>
        )}
        {taxLines.map((t) => (
          <div key={t.label} className="contents">
            <dt className="text-on-surface-muted">{t.label}</dt>
            <dd className="text-right tabular-nums">{money(t.amount)}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t border-border pt-2 text-[14px] font-semibold text-on-surface">Total</dt>
        <dd className="mt-1 border-t border-border pt-2 text-right text-[15px] font-bold tabular-nums text-on-surface">{money(quote.totalAmount)}</dd>
      </dl>
    </Card>
  );
}
