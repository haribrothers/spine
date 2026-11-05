import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import { t } from "../lib/server-t";

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

/**
 * An indeterminate loading indicator for actions with no known duration —
 * prefer Skeleton for content that has a known shape. `role="status"` +
 * `aria-label` live on a wrapping span, not the bare `<svg>` icon: an SVG
 * has no implicit ARIA role, so `aria-label` on the icon alone is not
 * reliably exposed as an accessible name by every screen reader, and a
 * loading state should announce as a polite live region so assistive tech
 * users learn something is in progress without focus moving anywhere.
 */
export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label ?? t("ui.spinner.loading")} className="inline-flex">
      <Loader2 size={sizeMap[size]} aria-hidden="true" className={cn("animate-spin text-on-surface-muted", className)} />
    </span>
  );
}
