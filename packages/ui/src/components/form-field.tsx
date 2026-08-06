import { useId } from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";
import { HelperText } from "./helper-text";

export interface FormFieldRenderProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
  "aria-required": boolean | undefined;
  required: boolean | undefined;
}

export interface FormFieldProps {
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  className?: string;
  /** Render-prop so the field can wire up id, aria attributes, and required onto any control. */
  children: (field: FormFieldRenderProps) => React.ReactNode;
}

/**
 * Label above, control, helper/error text below — never a floating or
 * placeholder-only label, per docs/DESIGN.md. The one place every form
 * control in the app should be composed from, rather than hand-wiring
 * Label/HelperText/aria attributes per screen. The required marker in the
 * label is decorative (aria-hidden) — the render prop also passes
 * `required`/`aria-required` so assistive tech announces requiredness from
 * the control itself, not just a visual asterisk.
 */
export function FormField({
  label,
  helperText,
  errorText,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const hasHelper = Boolean(errorText ?? helperText);
  const hasError = Boolean(errorText);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-overdue" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children({
        id,
        "aria-describedby": hasHelper ? helperId : undefined,
        "aria-invalid": hasError ? true : undefined,
        "aria-required": required ? true : undefined,
        required,
      })}
      {hasHelper && (
        <HelperText id={helperId} error={hasError}>
          {errorText ?? helperText}
        </HelperText>
      )}
    </div>
  );
}
