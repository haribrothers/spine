import { Text, View, type ViewProps } from "react-native";
import { cn } from "../lib/cn";

export interface EmptyStateProps extends ViewProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Ports `packages/ui`'s EmptyState — used for every zero-results list and
 * the first-run dashboard, per CLAUDE.md's onboarding principle: never a
 * blank screen with no next action.
 *
 * Unlike web (which sizes a descendant `<svg>` via a CSS `[&_svg]:h-6
 * [&_svg]:w-6` selector), RN has no descendant selector — the caller passes
 * an already-sized icon element directly (e.g. `<Inbox size={24}
 * color={...} />`), matching how every other icon usage in this package is
 * sized at the call site (see Foundation -> Icons).
 */
export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <View className={cn("items-center gap-2 px-6 py-12", className)} {...props}>
      {icon ? <View className="mb-2 items-center justify-center">{icon}</View> : null}
      <Text
        accessibilityRole="header"
        className="text-center text-[16px] font-semibold text-on-surface dark:text-on-surface-dark"
      >
        {title}
      </Text>
      {description ? (
        <Text className="max-w-sm text-center text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}
