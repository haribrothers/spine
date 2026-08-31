import { Text, type TextProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Ports `packages/ui`'s StatusChip — the single component for
 * paid/due-soon/overdue/draft, per docs/DESIGN.md and CLAUDE.md's
 * reserved-palette rule. Never repurposed for a generic badge/tag — see
 * Badge for that. Always pill-shaped and always paired with a text label;
 * color alone never carries the meaning (screen readers announce the text,
 * and it reads correctly in grayscale).
 *
 * A single Text (bg + text color together per status), same shape as
 * Badge — unlike Button/Card, there's only one variant axis here (status),
 * so there's no independently-conditioned second axis that could
 * contradict it and need `cn`'s dedupe for that reason. `cn` is still used
 * for the className merge itself, consistent with every other themed
 * component in this package.
 */
export const statusChipVariants = cva("self-start rounded-full px-2.5 py-0.5 text-[12px] font-medium", {
  variants: {
    status: {
      paid: "bg-paid-bg dark:bg-paid-bg-dark text-paid dark:text-paid-dark",
      "due-soon": "bg-due-soon-bg dark:bg-due-soon-bg-dark text-due-soon dark:text-due-soon-dark",
      overdue: "bg-overdue-bg dark:bg-overdue-bg-dark text-overdue dark:text-overdue-dark",
      draft: "bg-draft-bg dark:bg-draft-bg-dark text-draft dark:text-draft-dark",
    },
  },
  defaultVariants: {
    status: "draft",
  },
});

export interface StatusChipProps extends TextProps, VariantProps<typeof statusChipVariants> {}

export function StatusChip({ className, status, ...props }: StatusChipProps) {
  return <Text className={cn(statusChipVariants({ status }), className)} {...props} />;
}
