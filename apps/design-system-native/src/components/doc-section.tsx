import { ScrollView, Text, View, type ScrollViewProps } from "react-native";

/** Shared scaffolding for a component doc screen: a scrollable page of labeled example sections. */
export function DocScreen({ children, ...props }: ScrollViewProps) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4" {...props}>
      {children}
    </ScrollView>
  );
}

export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">{title}</Text>
      <View className="gap-3 rounded-lg border border-border bg-surface p-4">{children}</View>
    </View>
  );
}
