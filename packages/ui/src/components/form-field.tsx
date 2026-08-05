import { useId } from "react";
import { cn } from "../lib/cn";
import { Label } from "./label";
import { HelperText } from "./helper-text";

export interface FormFieldProps {
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  className?: string;
  /** Render-prop so the field can wire up id/aria-describedby onto any control. */
  children: (field: { id: string; "aria-describedby": string | undefined }) => React.ReactNode;
}

/**
 * Label above, control, helper/error text below — never a floating or
 * placeholder-only label, per docs/DESIGN.md. The one place every form
 * control in the app should be composed from, rather than hand-wiring
 * Label/HelperText/aria attributes per screen.
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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-overdue">*</span>}
      </Label>
      {children({ id, "aria-describedby": hasHelper ? helperId : undefined })}
      {hasHelper && (
        <HelperText id={helperId} error={Boolean(errorText)}>
          {errorText ?? helperText}
        </HelperText>
      )}
    </div>
  );
}
