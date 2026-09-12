import { View, type ViewProps } from "react-native";

/**
 * A plain 1px row separator for use INSIDE a form card/group between rows
 * (`FormSection`-style grouping) — never a standalone section separator on
 * its own, which is what web `packages/ui`'s `Separator` is for. Full-bleed
 * within its container (no horizontal inset) so it reads as separating two
 * rows rather than framing one field, matching the "borderless field, card
 * provides the boundary, dividers separate rows" form redesign.
 */
export function Divider({ className, ...props }: ViewProps) {
  return (
    <View
      className={["h-px w-full bg-border dark:bg-border-dark", className].filter(Boolean).join(" ")}
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...props}
    />
  );
}
