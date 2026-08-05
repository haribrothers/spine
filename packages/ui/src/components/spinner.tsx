import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

/** An indeterminate loading indicator for actions with no known duration — prefer Skeleton for content that has a known shape. */
export function Spinner({
  size = "md",
  className,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  return (
    <Loader2
      size={sizeMap[size]}
      className={cn("animate-spin text-on-surface-muted", className)}
      aria-label="Loading"
    />
  );
}
