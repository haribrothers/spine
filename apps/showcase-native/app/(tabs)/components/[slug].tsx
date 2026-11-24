import { Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { COMPONENT_CATALOG } from "../../../src/lib/component-catalog";
import { COMPONENT_DEMOS } from "../../../src/lib/component-demos";
import { DemoScreen } from "../../../src/components/demo-screen";

export default function ComponentDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const entry = COMPONENT_CATALOG.find((c) => c.slug === slug);
  const Demo = COMPONENT_DEMOS[slug ?? ""];

  if (!entry || !Demo) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-on-surface-muted dark:text-on-surface-muted-dark">Component not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: entry.title }} />
      <DemoScreen>
        <Demo />
      </DemoScreen>
    </>
  );
}
