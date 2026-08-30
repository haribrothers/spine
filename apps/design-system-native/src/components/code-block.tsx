import { ScrollView, Text } from "react-native";

/**
 * RN port of apps/design-system's code-block.tsx — a static syntax-neutral
 * snippet display. No copy-to-clipboard button: that's a nice-to-have on
 * web, not worth an expo-clipboard dependency for this internal docs tool.
 */
export function CodeBlock({ code }: { code: string }) {
  return (
    <ScrollView
      horizontal
      className="rounded-lg border border-border bg-neutral-900"
      contentContainerClassName="p-4"
    >
      <Text className="font-mono text-[12.5px] leading-relaxed text-neutral-50">{code}</Text>
    </ScrollView>
  );
}
