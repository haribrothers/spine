import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** Fixed, full-viewport overlay for a page-level operation; unset (the default) renders inline, filling its parent — for a section/panel that's mid-load rather than the whole screen. */
  fullScreen?: boolean;
}

/**
 * The "an operation is happening" indicator for a whole page or panel, not
 * a single button — pairs with Spinner (which stays inline on buttons) and
 * Skeleton (which stands in for content with a known shape). Sits at
 * `z-overlay`, one layer below `z-modal`, so a loader triggered from inside
 * a Dialog/Drawer never outranks it, matching the elevation order in
 * docs/DESIGN.md.
 */
export function PageLoader({ label = "Loading", fullScreen = false, className, ...props }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-surface/70 backdrop-blur-[1px]",
        fullScreen ? "fixed inset-0 z-overlay" : "absolute inset-0 z-dropdown",
        className,
      )}
      {...props}
    >
      <Spinner size="lg" label={label} />
    </div>
  );
}
