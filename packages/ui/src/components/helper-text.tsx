import { cn } from "../lib/cn";

export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  error?: boolean;
}

/**
 * Field-level helper or error text, per docs/DESIGN.md's Form field spec —
 * muted grey by default, switching to the overdue-red color on a
 * validation error (the one place that red is reused outside financial
 * status, since the two never appear in the same view).
 */
export function HelperText({ className, error = false, ...props }: HelperTextProps) {
  return (
    <p
      className={cn(
        "text-[13px]",
        error ? "text-overdue" : "text-on-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
