import { ScrollView, Text, View, type ViewProps } from "react-native";

/**
 * Shared layout for every `components/[slug].tsx` demo screen — a
 * scrollable page with a lead description and one or more labeled
 * sections. Deliberately NOT a port of `apps/design-system-native`'s
 * `DocScreen`/`ComponentPreview` web-doc-app primitives (those assume a
 * desktop/mobile dual-shell and `cmdk`-style search that don't apply
 * here) — this app's demo screens are plain native screens reachable via
 * `NativeTabs`, not a documentation site.
 */
export function DemoScreen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-6 p-4"
    >
      {children}
    </ScrollView>
  );
}

export function DemoLead({ children }: { children: React.ReactNode }) {
  return <Text className="text-[14px] leading-relaxed text-on-surface-muted dark:text-on-surface-muted-dark">{children}</Text>;
}

export function DemoSection({ title, children, ...props }: { title: string; children: React.ReactNode } & ViewProps) {
  return (
    <View className="gap-3" {...props}>
      <Text className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">{title}</Text>
      {children}
    </View>
  );
}

export function DemoPreview({ children }: { children: React.ReactNode }) {
  return (
    <View className="items-start gap-3 rounded-lg border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      {children}
    </View>
  );
}
