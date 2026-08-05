import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, Math.max(page + 2, 5));
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  const pages = pageWindow(page, pageCount);

  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Pagination">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors",
            p === page
              ? "bg-primary text-white"
              : "text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
