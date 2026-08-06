"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { Pagination } from "./pagination";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | bigint;
  align?: "left" | "right";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  className?: string;
}

type SortDirection = "asc" | "desc";

/**
 * Zero-radius, dense row height, sticky header, sortable columns, and
 * client-side pagination — the primary vehicle for quote/invoice line
 * items and the AR/AP aging report, per docs/DESIGN.md.
 */
export function Table<T>({ columns, data, rowKey, pageSize = 20, className }: TableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [data, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-sticky-header border-b border-border bg-surface-sunken">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={
                    column.sortValue
                      ? sort?.key === column.key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium text-on-surface-muted",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-surface-sunken">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-on-surface",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="self-end" />
      )}
    </div>
  );
}
