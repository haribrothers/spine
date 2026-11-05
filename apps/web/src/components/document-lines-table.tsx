"use client";

import { SUPPLY_CLASS_LABELS } from "@spine/shared";
import { Card, cn } from "@spine/ui";
import type { SupplyClass } from "@spine/shared";
import { formatMoney } from "../lib/money";
import { useT } from "../lib/i18n";

/** What the table reads from a quote or an invoice. */
export interface DocumentLinesSource {
  currency: string;
  placeOfSupply: string | null;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  taxLines?: { label: string; amount: string }[];
  lines?: {
    id: string;
    sortOrder: number;
    type: "item" | "heading" | "text";
    name: string;
    description: string | null;
    quantity: number;
    unitPriceAmount: string;
    discountPercentage: number;
    taxRatePercentage: number;
    supplyClass: SupplyClass | null;
    lineTotalAmount: string;
  }[];
}

/** A row under Total: Retention held, Paid, Credited, Balance due (US-INV-31). */
export interface AfterTotalRow {
  label: string;
  /** Minor units; shown negative when `subtract`. */
  amount: bigint;
  subtract?: boolean;
  tone?: "paid" | "balance" | "overdue";
}

/**
 * US-QUO-31 (D-214), US-INV-31 (D-217) — a quote's or an invoice's lines
 * as a table: Item (with its description), Qty, Rate, Discount and Tax
 * (only when any line has them) and Amount; headings span the row in bold,
 * text lines in muted text. Totals sit under it — Discount only when there
 * is one, and the tax by name (CGST and SGST on a GST document) as on the
 * PDF — then whatever follows Total (an invoice's retention, Paid and
 * Balance due).
 */
export function DocumentLinesTable({ doc: quote, testIdPrefix, after = [] }: { doc: DocumentLinesSource; testIdPrefix: string; after?: AfterTotalRow[] }) {
  const t = useT();
  const lines = (quote.lines ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const items = lines.filter((l) => l.type === "item");
  const showDiscount = items.some((l) => l.discountPercentage > 0);
  const showTax = items.some((l) => l.taxRatePercentage > 0);
  const money = (v: string) => formatMoney(BigInt(v), quote.currency);
  const cols = 3 + (showDiscount ? 1 : 0) + (showTax ? 1 : 0);
  const discount = BigInt(quote.discountAmount);
  const taxLines = quote.taxLines?.length ? quote.taxLines : [{ label: t("invoices.linesTable.tax"), amount: quote.taxAmount }];

  return (
    <Card className="overflow-hidden p-0" data-testid={`${testIdPrefix}-lines`}>
      <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">{t("invoices.linesTable.lines")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-surface-sunken text-left text-[12px] font-medium text-on-surface-muted">
              <th scope="col" className="px-4 py-2 font-medium">{t("invoices.linesTable.item")}</th>
              <th scope="col" className="w-20 px-2 py-2 text-right font-medium">{t("invoices.linesTable.qty")}</th>
              <th scope="col" className="w-28 px-2 py-2 text-right font-medium">{t("invoices.linesTable.rate")}</th>
              {showDiscount && <th scope="col" className="w-16 px-2 py-2 text-right font-medium">{t("invoices.linesTable.disc")}</th>}
              {showTax && <th scope="col" className="w-16 px-2 py-2 text-right font-medium">{t("invoices.linesTable.tax")}</th>}
              <th scope="col" className="w-32 px-4 py-2 text-right font-medium">{t("invoices.linesTable.amount")}</th>
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
      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-[13px]" data-testid={`${testIdPrefix}-totals`}>
        <dt className="text-on-surface-muted">{t("invoices.linesTable.subtotal")}</dt>
        <dd className="text-right tabular-nums">{money(quote.subtotalAmount)}</dd>
        {discount > 0n && (
          <>
            <dt className="text-on-surface-muted">{t("invoices.linesTable.discount")}</dt>
            <dd className="text-right tabular-nums">{formatMoney(-discount, quote.currency)}</dd>
          </>
        )}
        {taxLines.map((taxLine) => (
          <div key={taxLine.label} className="contents">
            <dt className="text-on-surface-muted">{taxLine.label}</dt>
            <dd className="text-right tabular-nums">{money(taxLine.amount)}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t border-border pt-2 text-[14px] font-semibold text-on-surface">{t("invoices.linesTable.total")}</dt>
        <dd className="mt-1 border-t border-border pt-2 text-right text-[15px] font-bold tabular-nums text-on-surface">{money(quote.totalAmount)}</dd>
        {after.map((row) => (
          <div key={row.label} className="contents">
            <dt className={cn(row.tone === "paid" ? "text-paid" : row.tone ? "mt-1 border-t border-border pt-2 text-[14px] font-semibold text-on-surface" : "text-on-surface-muted")}>{row.label}</dt>
            <dd
              className={cn(
                "text-right tabular-nums",
                row.tone === "paid" && "text-paid",
                row.tone === "balance" && "mt-1 border-t border-border pt-2 text-[15px] font-bold text-on-surface",
                row.tone === "overdue" && "mt-1 border-t border-border pt-2 text-[15px] font-bold text-overdue",
              )}
            >
              {formatMoney(row.subtract ? -row.amount : row.amount, quote.currency)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
