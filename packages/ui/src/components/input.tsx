import { forwardRef } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={ariaInvalid ?? (error ? true : undefined)}
      className={cn(
        "h-10 w-full rounded-sm border bg-surface px-2.5 text-[14px] text-on-surface placeholder:text-on-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-overdue" : "border-border-strong",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
