import { cn } from "../lib/cn";

/** Heading/prose style presets matching docs/DESIGN.md's type scale — for content-heavy screens (a quote's terms, a help article) rather than dashboard chrome. */
export function Display({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("text-[32px] font-bold leading-tight tracking-tight text-on-surface", className)} {...props} />;
}

export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("text-[24px] font-bold leading-snug tracking-tight text-on-surface", className)} {...props} />;
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[18px] font-semibold leading-snug text-on-surface", className)} {...props} />;
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold text-on-surface", className)} {...props} />;
}

export function Lead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[15px] leading-relaxed text-on-surface-muted", className)} {...props} />;
}

export function P({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[14px] leading-relaxed text-on-surface", className)} {...props} />;
}

export function Muted({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-on-surface-muted", className)} {...props} />;
}
