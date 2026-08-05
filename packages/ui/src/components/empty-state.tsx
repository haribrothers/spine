import { cn } from "../lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Used for every zero-results list and the first-run dashboard, per
 * §FEAT-12 — the app's onboarding principle is "never a blank screen with
 * no next action."
 */
export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}
      {...props}
    >
      {icon && <div className="mb-2 text-on-surface-muted [&_svg]:h-6 [&_svg]:w-6">{icon}</div>}
      <h3 className="text-[16px] font-semibold text-on-surface">{title}</h3>
      {description && <p className="max-w-sm text-[13px] text-on-surface-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
