import { cva, type VariantProps } from "class-variance-authority";
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

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

export function Alert({ className, variant, icon, children, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant, className }))} {...props}>
      {icon && <div className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</div>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-semibold text-on-surface", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-on-surface-muted", className)} {...props} />;
}
