import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "../lib/cn";
import { t } from "../lib/server-t";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * One line at every width (US-OPS-61): when space runs out the middle items
 * shorten with "…" first, then the last; the first keeps its text. Links are
 * inline-flex so the 44px phone tap height (US-OPS-14) centres their text
 * on the line instead of lifting it above the others.
 */
/** How an item gives way when the line is full: the middle ones first, then the last (the record). */
function fitClass(isMiddle: boolean, isLastOfMany: boolean): string {
  if (isMiddle) return "min-w-[3ch] truncate";
  if (isLastOfMany) return "min-w-0 shrink-[0.1] truncate";
  return "shrink-0 whitespace-nowrap";
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label={t("ui.breadcrumb.label")} className={cn("flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden text-[13px]", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isMiddle = index > 0 && !isLast;
        const fit = fitClass(isMiddle, isLast && index > 0);
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-on-surface-muted" />}
            {item.href && !isLast ? (
              <a
                href={item.href}
                title={isMiddle ? item.label : undefined}
                className={cn(
                  "inline-flex items-center rounded-sm text-on-surface-muted transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  // US-OPS-62: at least 44px wide to tap on a phone, even a short label like "Jobs".
                  isMiddle ? "min-w-0 max-md:min-w-11" : "shrink-0 max-md:min-w-11",
                )}
              >
                <span className={fit}>{item.label}</span>
              </a>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                title={isMiddle ? item.label : undefined}
                className={cn(fit, isLast ? "font-medium text-on-surface" : "text-on-surface-muted")}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
