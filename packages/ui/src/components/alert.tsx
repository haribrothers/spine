import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * A persistent, page-level, non-dismissible-by-default inline message —
 * distinct from Toast (temporary/dismissible) and StatusChip (per-row
 * status). Uses the same paid/due-soon/overdue/info background+text pairs
 * as StatusChip, but as a full-width bar, never color alone.
 */
export const alertVariants = cva("flex items-start gap-3 rounded-md border p-3 text-[13px]", {
  variants: {
    variant: {
      info: "border-info-bg bg-info-bg text-on-surface",
      warning: "border-due-soon-bg bg-due-soon-bg text-on-surface",
      critical: "border-overdue-bg bg-overdue-bg text-on-surface",
      success: "border-paid-bg bg-paid-bg text-on-surface",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

/**
 * The four variants only differ by background tint (all share
 * `text-on-surface`), so a default icon per variant is the fallback that
 * keeps every real call site from becoming color-only — every current
 * usage in apps/web omits the `icon` prop, per docs/DESIGN.md's own "never
 * color alone" rule. Pass `icon={null}` explicitly to render no icon.
 */
const DEFAULT_ICONS = {
  info: <Info />,
  warning: <AlertTriangle />,
  critical: <AlertCircle />,
  success: <CheckCircle2 />,
} as const;

const ALERT_ROLES = {
  info: "status",
  warning: "status",
  critical: "alert",
  success: "status",
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** Defaults to a variant-appropriate icon (see DEFAULT_ICONS) — pass `null` for no icon. */
  icon?: React.ReactNode;
}

export function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  const resolvedVariant = variant ?? "info";
  const resolvedIcon = icon === undefined ? DEFAULT_ICONS[resolvedVariant] : icon;
  return (
    <div role={ALERT_ROLES[resolvedVariant]} className={cn(alertVariants({ variant, className }))} {...props}>
      {resolvedIcon && <div className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4">{resolvedIcon}</div>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-semibold text-on-surface", className)} {...props} />;
}

/**
 * Full-contrast text: muted text on the alert tints fell below 4.5:1 (4.37:1
 * on the critical tint in light mode, caught by US-OPS-33's axe check).
 */
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-on-surface", className)} {...props} />;
}
