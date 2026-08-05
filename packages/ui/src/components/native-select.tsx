import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

/** A plain native <select> for simple flat option lists — reach for the Radix-based Select for richer chrome/grouping needs. */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-sm border border-border-strong bg-surface px-2.5 pr-8 text-[14px] text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted" />
    </div>
  ),
);

NativeSelect.displayName = "NativeSelect";
