import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../lib/cn";
import { t } from "../lib/server-t";

/**
 * A full-width notice across the top of the content area, above the page
 * header — for app-wide states an Owner should act on (an update is
 * available, storage is nearly full). Distinct from Alert, which sits
 * inside a page's content, and Toast, which is temporary.
 */
export const bannerVariants = cva("flex items-start gap-3 border-b px-6 py-3 text-[13px] text-on-surface lg:px-8", {
  variants: {
    variant: {
      info: "border-info-bg bg-info-bg [&_[data-banner-icon]]:text-info",
      warning: "border-due-soon-bg bg-due-soon-bg [&_[data-banner-icon]]:text-due-soon",
      critical: "border-overdue-bg bg-overdue-bg [&_[data-banner-icon]]:text-overdue",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const DEFAULT_ICONS = {
  info: <Info />,
  warning: <AlertTriangle />,
  critical: <AlertCircle />,
} as const;

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof bannerVariants> {
  /** The bold lead, e.g. "Spine 1.4 is available." */
  title?: React.ReactNode;
  /** Defaults to a variant icon so colour is never the only signal; pass `null` for none. */
  icon?: React.ReactNode;
  /** Links or buttons on the right, e.g. "What's new". */
  actions?: React.ReactNode;
  /** Shows a close button when given. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function Banner({
  className,
  variant,
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel,
  children,
  ...props
}: BannerProps) {
  const resolved = variant ?? "info";
  const resolvedIcon = icon === undefined ? DEFAULT_ICONS[resolved] : icon;
  return (
    <div role={resolved === "critical" ? "alert" : "status"} className={cn(bannerVariants({ variant, className }))} {...props}>
      {resolvedIcon && (
        <div data-banner-icon className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
          {resolvedIcon}
        </div>
      )}
      <p className="min-w-0 flex-1">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </p>
      {actions && <div className="flex shrink-0 items-center gap-3 font-medium text-primary">{actions}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? t("ui.banner.dismiss")}
          className="-m-1 shrink-0 rounded p-1 text-on-surface-muted hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
