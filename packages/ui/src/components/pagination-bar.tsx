"use client";

import { NativeSelect } from "./native-select";
import { Pagination } from "./pagination";
import { cn } from "../lib/cn";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}

/**
 * Pairs a page-size <select> with Pagination and a "x–y of n" summary — the
 * configurable list-page footer (Contacts, Catalogue, and any future list
 * that fetches its full result set and paginates client-side) rather than
 * each screen wiring page-size state and the row-count string by hand.
 */
export function PaginationBar({
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationBarProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div data-print="hide" className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 text-[13px] text-on-surface-muted">
        <span>
          {start}–{end} of {total}
        </span>
        <span className="flex items-center gap-1.5">
          <label htmlFor="pagination-bar-page-size" className="sr-only">
            Rows per page
          </label>
          per page
          <NativeSelect
            id="pagination-bar-page-size"
            className="h-8 w-[68px] px-2 text-[13px]"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </span>
      </div>
      {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />}
    </div>
  );
}
