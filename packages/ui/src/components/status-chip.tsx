import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * The single component for paid/due-soon/overdue/draft, per docs/DESIGN.md.
 * This reserved palette is never repurposed for a generic badge/tag — see
 * Badge below for that. Always pill-shaped and always paired with a text
 * label; color alone never carries the meaning.
 */
export const statusChipVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium",
  {
    variants: {
      status: {
        paid: "bg-paid-bg text-paid",
        "due-soon": "bg-due-soon-bg text-due-soon",
        overdue: "bg-overdue-bg text-overdue",
        draft: "bg-draft-bg text-draft",
      },
    },
    defaultVariants: {
      status: "draft",
    },
  },
);

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {}

export function StatusChip({ className, status, ...props }: StatusChipProps) {
  return <span className={cn(statusChipVariants({ status, className }))} {...props} />;
}
