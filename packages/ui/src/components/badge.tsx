import { cn } from "../lib/cn";

/**
 * A compact neutral-toned indicator for counts/tags/generic status — visually
 * similar to StatusChip but never used for financial status, which stays
 * StatusChip's reserved semantic (see docs/DESIGN.md).
 */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-[12px] font-medium text-on-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
