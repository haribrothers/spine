"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export interface DropdownMenuContentProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {
  /** US-OPS-60: on a phone, the menu is an action sheet headed by what it acts on ("INV-0044"). */
  sheetTitle?: string;
  /** US-OPS-58: a line under the sheet's title ("Sahyadri Retail · $13,25,514.50 due"). */
  sheetDescription?: string;
}

/**
 * US-OPS-60 (D-283): under 768px the menu is an action sheet — docked near the bottom edge
 * over the dimmed page (`data-phone-sheet="action"`), larger rows with their icons, a
 * destructive item in the danger colour (it still asks first, D-218), and a Cancel at the end.
 */
export const DropdownMenuContent = forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Content>, DropdownMenuContentProps>(
  ({ className, sideOffset = 4, sheetTitle, sheetDescription, children, ...props }, ref) => {
    const t = useT();
    const phone = usePhone();
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          data-phone-sheet="action"
          className={cn(
            "z-[var(--z-popover)] min-w-48 overflow-hidden rounded-md border border-border bg-surface p-1 shadow-raised dark:max-md:bg-neutral-100",
            className,
          )}
          {...props}
        >
          {phone && sheetTitle ? (
            <DropdownMenuPrimitive.Label className="border-b border-border px-4 py-3 text-center text-[13px] font-semibold text-on-surface">
              {sheetTitle}
              {sheetDescription ? <span className="block text-[12.5px] font-normal text-on-surface-muted">{sheetDescription}</span> : null}
            </DropdownMenuPrimitive.Label>
          ) : null}
          {children}
          {phone ? (
            <DropdownMenuPrimitive.Item className="flex min-h-[52px] cursor-pointer select-none items-center justify-center border-t-8 border-background text-[16px] font-[650] text-on-surface outline-none data-[highlighted]:bg-surface-sunken">
              {t("ui.actionSheet.cancel")}
            </DropdownMenuPrimitive.Item>
          ) : null}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive = false, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      // US-OPS-37 (D-222): the menu owns its icon's size, colour and spacing — screens never add their own.
      "flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-3.5 [&>svg]:shrink-0",
      // US-OPS-60: an action sheet's rows on a phone.
      "max-md:min-h-[52px] max-md:gap-3.5 max-md:rounded-none max-md:px-4 max-md:text-[16px] max-md:[&>svg]:size-5",
      destructive ? "text-overdue [&>svg]:text-overdue" : "text-on-surface [&>svg]:text-on-surface-muted",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-[13px] text-on-surface outline-none data-[highlighted]:bg-surface-sunken",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex items-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check size={14} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuRadioItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-[13px] text-on-surface outline-none data-[highlighted]:bg-surface-sunken",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex items-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle size={8} fill="currentColor" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-[12px] font-semibold text-on-surface-muted", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-border max-md:my-0", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuSubTrigger = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] text-on-surface outline-none data-[highlighted]:bg-surface-sunken data-[state=open]:bg-surface-sunken [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-on-surface-muted",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight size={14} className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-[var(--z-popover)] min-w-[8rem] overflow-hidden rounded-md border border-border bg-surface p-1 shadow-raised",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
