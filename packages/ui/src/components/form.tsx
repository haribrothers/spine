"use client";

import * as FormPrimitive from "@radix-ui/react-form";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

/**
 * Native-validation-driven form (Radix Form) — for real submitted forms
 * with required/pattern/match rules, e.g. a matrix-entry or org-structure
 * create form. `RadixFormField` is namespaced to avoid colliding with the
 * simpler, non-validation `FormField` composition in form-field.tsx, which
 * remains the right choice for a single already-validated field outside a
 * submitted form.
 */
export const Form = FormPrimitive.Root;
export const RadixFormField = FormPrimitive.Field;

export const FormLabel = forwardRef<
  React.ElementRef<typeof FormPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof FormPrimitive.Label>
>(({ className, ...props }, ref) => (
  <FormPrimitive.Label ref={ref} className={cn("text-[13px] font-semibold text-on-surface", className)} {...props} />
));
FormLabel.displayName = "FormLabel";

export const FormControl = forwardRef<
  React.ElementRef<typeof FormPrimitive.Control>,
  React.ComponentPropsWithoutRef<typeof FormPrimitive.Control>
>(({ className, ...props }, ref) => (
  <FormPrimitive.Control
    ref={ref}
    className={cn(
      "h-10 w-full rounded-sm border border-border-strong bg-surface px-2.5 text-[14px] text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      className,
    )}
    {...props}
  />
));
FormControl.displayName = "FormControl";

export const FormMessage = forwardRef<
  React.ElementRef<typeof FormPrimitive.Message>,
  React.ComponentPropsWithoutRef<typeof FormPrimitive.Message>
>(({ className, ...props }, ref) => (
  <FormPrimitive.Message ref={ref} className={cn("text-[13px] text-overdue", className)} {...props} />
));
FormMessage.displayName = "FormMessage";

export const FormSubmit = FormPrimitive.Submit;
export const FormValidityState = FormPrimitive.ValidityState;
