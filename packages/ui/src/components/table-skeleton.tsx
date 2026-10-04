import { cn } from "../lib/cn";
import { Skeleton } from "./skeleton";

export interface TableSkeletonColumn {
  key: string;
  header: string;
  align?: "left" | "right";
  /** Tailwind width class for this column's skeleton bar, e.g. "w-32" — defaults to a sensible fallback if omitted. */
  width?: string;
}

export interface TableSkeletonProps {
  columns: TableSkeletonColumn[];
  rows?: number;
  className?: string;
}

/**
 * A loading placeholder shaped like Table/DataTable's actual rendered
 * output — same `<table>`/`<thead>` markup and column headers as the real
 * component (not a generic set of bars), so the page doesn't visibly
 * reflow once data arrives and the skeleton always reflects the current
 * column set. Pass the same `columns` array (or the header/align subset of
 * it) used for the live Table/DataTable so the two never drift apart.
 */
export function TableSkeleton({ columns, rows = 8, className }: TableSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead className="border-b border-border bg-surface-sunken">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium text-on-surface-muted",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-3 py-2", column.align === "right" ? "text-right" : "text-left")}
                  >
                    <Skeleton className={cn("h-4", column.width ?? "w-24", column.align === "right" && "ml-auto")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
