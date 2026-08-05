import { cn } from "../lib/cn";

/** A border-colored pulsing block matching the shape of the loading content, per §F0. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-sm bg-border", className)} {...props} />;
}
