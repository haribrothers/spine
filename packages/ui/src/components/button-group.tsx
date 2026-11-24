import { cn } from "../lib/cn";

/** A row of related Buttons with joined edges — e.g. a view-switcher (List / Board) that isn't a Tabs navigation. */
export function ButtonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:-ml-px",
        className,
      )}
      {...props}
    />
  );
}
