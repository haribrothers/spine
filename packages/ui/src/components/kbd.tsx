import { cn } from "../lib/cn";

/** A keyboard-shortcut hint, e.g. the ⌘K search trigger. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "rounded border border-border-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-on-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
