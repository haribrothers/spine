import { Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { COMPONENT_CATALOG } from "../../../src/lib/component-catalog";
import { COMPONENT_DEMOS } from "../../../src/lib/component-demos";
import { DemoScreen } from "../../../src/components/demo-screen";

/**
 * A second copy of `components/[slug].tsx`'s route, living inside Search's
 * own tab stack — a real, user-reported bug otherwise: linking to
 * `/components/[slug]` from the Search tab pushed onto the COMPONENTS
 * tab's stack (since `NativeTabs` gives each tab its own independent
 * navigation stack, and the detail screen only existed under `components/`
 * before this file existed), so tapping back returned to the Components
 * list rather than back to Search. Rendering the exact same demo content
 * from `component-demos.ts` here keeps the back stack correctly rooted at
 * Search when reached from there. Not a duplicated implementation beyond
 * this thin route file — `component-demos.ts`/`component-catalog.ts`/
 * `DemoScreen` are all shared, single sources of truth.
 */
export default function SearchComponentDetailScreen() {
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
