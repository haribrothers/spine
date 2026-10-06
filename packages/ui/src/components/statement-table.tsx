import { Fragment } from "react";
import { cn } from "../lib/cn";

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
 */
export function StatementTable({ columns, rows, className, "data-testid": testId }: StatementTableProps) {
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
            <td key={column.key} className={cn("px-3", row.kind === "line" ? "py-2" : "py-2.5", alignClass(column), column.align === "right" && "whitespace-nowrap")}>
              {row.cells[column.key]}
            </td>
          ))}
        </tr>
      )}
    </Fragment>
  );
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-[13px]" data-testid={testId}>
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("whitespace-nowrap px-3 py-2 font-medium text-on-surface-muted", column.align === "right" ? "text-right" : "text-left")}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.filter((row) => row.kind !== "total").map((row) => renderRow(row))}</tbody>
        {rows.some((row) => row.kind === "total") && <tfoot>{rows.filter((row) => row.kind === "total").map((row) => renderRow(row))}</tfoot>}
      </table>
    </div>
  );
}
