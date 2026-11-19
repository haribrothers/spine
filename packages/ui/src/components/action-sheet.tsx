"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { DialogOverlay } from "./dialog";

export interface ActionSheetAction {
  key: string;
  label: string;
  /** The action's menu icon (`lib/menu-icons.ts`, D-222). */
  icon?: React.ReactNode;
  /** Runs after the sheet closes. A major action opens its confirmation from here (D-218). */
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the actions act on: "INV-0044". */
  title: string;
  /** A line under it: "Lakshmi Multispeciality Hospital · ₹3,45,000.00". */
  subtitle?: string;
  actions: ActionSheetAction[];
  "data-testid"?: string;
}

/**
 * US-OPS-60 (D-283) — a menu on a phone: the record it's for, each action with its icon,
 * a destructive action in the danger colour, and a separate Cancel. Choosing an action
 * closes the sheet first, then runs it, so a confirmation opens over the page, not the
 * sheet. Focus stays inside; Escape, Cancel or the dimmed page closes it.
 */
export function ActionSheet({ open, onOpenChange, title, subtitle, actions, "data-testid": testId }: ActionSheetProps) {
  const t = useT();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid={testId}
          data-action-sheet=""
          {...(subtitle ? {} : { "aria-describedby": undefined })}
          className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[var(--z-modal)] flex max-h-[calc(100dvh-72px)] flex-col gap-2 focus:outline-none motion-safe:animate-sheet-in"
        >
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface shadow-overlay dark:bg-neutral-100">
            <div className="shrink-0 border-b border-border px-4 py-3 text-center">
              <DialogPrimitive.Title className="text-[13px] font-semibold text-on-surface">{title}</DialogPrimitive.Title>
              {subtitle ? <DialogPrimitive.Description className="text-[12px] text-on-surface-muted">{subtitle}</DialogPrimitive.Description> : null}
            </div>
            <div className="min-h-0 overflow-y-auto">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => {
                    onOpenChange(false);
                    // After the sheet has closed, so a confirmation dialog takes focus cleanly.
                    setTimeout(action.onSelect, 0);
                  }}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3.5 border-b border-border px-4 text-left text-[16px] font-medium text-on-surface last:border-b-0 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-50 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
                    action.destructive ? "text-overdue [&_svg]:text-overdue" : "[&_svg]:text-on-surface-muted",
                  )}
                >
                  {action.icon}
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogPrimitive.Close className="min-h-[52px] shrink-0 rounded-lg bg-surface text-[16px] font-[650] text-on-surface shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-neutral-100">
            {t("ui.actionSheet.cancel")}
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
