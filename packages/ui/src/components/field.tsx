import { cn } from "../lib/cn";

/**
 * A richer layout primitive for grouping multiple FormFields — e.g. a
 * two-column address block, or a fieldset with a legend. Distinct from
 * FormField (form-field.tsx), which wires up a single label/control/
 * helper-text triplet; Field/FieldGroup/FieldSet only handle layout.
 */
export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function FieldGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)} {...props} />;
}

export function FieldSet({ className, ...props }: React.FieldsetHTMLAttributes<HTMLFieldSetElement>) {
  return <fieldset className={cn("flex flex-col gap-4 rounded-lg border border-border bg-surface p-4", className)} {...props} />;
}

export function FieldLegend({ className, ...props }: React.HTMLAttributes<HTMLLegendElement>) {
  return <legend className={cn("px-1 text-[13px] font-semibold text-on-surface", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[12px] text-on-surface-muted", className)} {...props} />;
}
