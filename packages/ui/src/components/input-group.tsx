import { cn } from "../lib/cn";

/** Wraps an Input with a leading/trailing icon or addon (e.g. SearchInput's leading search icon, a trailing currency-code addon). */
export function InputGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-sm border border-border-strong bg-surface px-2.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-surface",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("shrink-0 text-[13px] text-on-surface-muted [&_svg]:h-4 [&_svg]:w-4", className)} {...props} />
  );
}

export function InputGroupInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-full w-full bg-transparent text-[14px] text-on-surface placeholder:text-on-surface-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
