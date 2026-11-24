"use client";

import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";
import { ScrollX } from "./scroll-x";

export interface StatementColumn {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right";
}

export type StatementRow =
  /** An uppercase heading that starts a section ("Income", "Operating activities"). */
  | { kind: "section"; key: string; label: React.ReactNode }
  /** A muted line across the table, e.g. "Nothing in this period." */
  | { kind: "empty"; key: string; label: React.ReactNode }
  /** A line, a section's subtotal (bold) or the statement's total (bold on a sunken band). */
  | { kind: "line" | "subtotal" | "total"; key: string; cells: Record<string, React.ReactNode>; testId?: string };

export interface StatementTableProps {
  columns: StatementColumn[];
  rows: StatementRow[];
  className?: string;
  "data-testid"?: string;
}

/**
 * A financial statement as a table — Profit & Loss, Balance Sheet, Cash
 * Flow, Tax Summary, a ledger account's entries — with the same header,
 * type size and spacing as `Table`, plus section headings, subtotals and
 * a total (in the table's footer). Statements aren't sorted or paged; their
 * order is the meaning.
 *
 * US-RPT-41: under 768px a statement with one label column and one amount (or an amount and the
 * period it's compared with) is an indented list — section headings, each account with its
 * amount on the right (and the other period's under it, muted), bold subtotals and the total
 * last; an account that links to its drill-down is tapped anywhere on its row. Anything wider
 * (three or more periods, a ledger's columns) stays a table whose first column stays put while
 * the others scroll sideways.
 */
export function StatementTable({ columns, rows, className, "data-testid": testId }: StatementTableProps) {
  const t = useT();
  const phone = usePhone();
  const labels = columns.filter((c) => c.align !== "right");
  const amounts = columns.filter((c) => c.align === "right");
  if (phone && labels.length === 1 && amounts.length >= 1 && amounts.length <= 2) {
    return <StatementList label={labels[0]!} amounts={amounts} rows={rows} className={className} testId={testId} />;
  }
  const sticky = phone ? "sticky left-0 z-[1] shadow-[1px_0_0_var(--color-border)]" : "";
  const alignClass = (column: StatementColumn) => (column.align === "right" ? "text-right tabular-nums" : "text-left");
  const renderRow = (row: StatementRow) => (
    <Fragment key={row.key}>
      {row.kind === "section" ? (
        <tr>
          <th scope="rowgroup" colSpan={columns.length} className="px-3 pb-1 pt-4 text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
            {row.label}
          </th>
        </tr>
      ) : row.kind === "empty" ? (
        <tr className="border-b border-border">
          <td colSpan={columns.length} className="px-3 py-2 text-on-surface-muted">
            {row.label}
          </td>
        </tr>
      ) : (
        <tr
          data-testid={row.testId}
          className={cn(
            "border-b border-border text-on-surface",
            row.kind === "line" && "hover:bg-surface-sunken",
            row.kind === "subtotal" && "font-semibold",
            row.kind === "total" && "border-b-0 border-t bg-surface-sunken text-[14px] font-semibold",
          )}
        >
          {columns.map((column) => (
            <td
              key={column.key}
              className={cn(
                "px-3",
                row.kind === "line" ? "py-2" : "py-2.5",
                alignClass(column),
                column.align === "right" && "whitespace-nowrap",
                column === columns[0] && sticky && cn(sticky, row.kind === "total" ? "bg-surface-sunken" : "bg-surface"),
              )}
            >
              {row.cells[column.key]}
            </td>
          ))}
        </tr>
      )}
    </Fragment>
  );
  return (
    <ScrollX label={t("ui.scrollX.label")} className={cn("rounded-lg border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-[13px]" data-testid={testId}>
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("whitespace-nowrap px-3 py-2 font-medium text-on-surface-muted", column.align === "right" ? "text-right" : "text-left", column === columns[0] && sticky && cn(sticky, "bg-surface-sunken"))}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.filter((row) => row.kind !== "total").map((row) => renderRow(row))}</tbody>
        {rows.some((row) => row.kind === "total") && <tfoot>{rows.filter((row) => row.kind === "total").map((row) => renderRow(row))}</tfoot>}
      </table>
    </ScrollX>
  );
}

/** US-RPT-41: a statement on a phone, as an indented list. */
function StatementList({ label, amounts, rows, className, testId }: { label: StatementColumn; amounts: StatementColumn[]; rows: StatementRow[]; className?: string; testId?: string }) {
  const [main, other] = amounts;
  const ordered = [...rows.filter((row) => row.kind !== "total"), ...rows.filter((row) => row.kind === "total")];
  return (
    <ul className={cn("-mx-4 border-y border-border bg-surface text-[14px]", className)} data-testid={testId} data-statement-list="">
      {ordered.map((row) =>
        row.kind === "section" ? (
          <li key={row.key} className="px-4 pb-1 pt-4 text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
            {row.label}
          </li>
        ) : row.kind === "empty" ? (
          <li key={row.key} className="px-4 py-2 pl-8 text-on-surface-muted">
            {row.label}
          </li>
        ) : (
          <li
            key={row.key}
            data-testid={row.testId}
            className={cn(
              "group relative flex min-h-11 items-center gap-3 pr-4",
              row.kind === "line" ? "py-0.5 pl-8 text-on-surface" : "border-t border-border py-2.5 pl-4 font-semibold text-on-surface",
              row.kind === "total" && "bg-surface-sunken text-[15px]",
              // A drill-down (a link or a button) covers the whole row.
              "[&_:is(a,button)]:text-left [&_:is(a,button)]:text-on-surface [&_:is(a,button)]:no-underline [&_:is(a,button)]:after:absolute [&_:is(a,button)]:after:inset-0 [&_:is(a,button)]:after:content-['']",
            )}
          >
            <span className="min-w-0 flex-1">{row.cells[label.key]}</span>
            <span className="flex shrink-0 flex-col items-end tabular-nums">
              <span>{row.cells[main!.key]}</span>
              {other && (
                <span className="text-[12.5px] font-normal text-on-surface-muted">
                  <span className="sr-only">{other.header}: </span>
                  {row.cells[other.key]}
                </span>
              )}
            </span>
            <ChevronRight size={16} aria-hidden className="-mr-1 hidden shrink-0 text-on-surface-muted group-has-[:is(a,button)]:block" />
          </li>
        ),
      )}
    </ul>
  );
}
