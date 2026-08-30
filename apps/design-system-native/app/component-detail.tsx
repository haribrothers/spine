import { Text, View } from "react-native";
import { DOC_SCREENS } from "../src/lib/component-screens";
import type { SectionSlug } from "../src/lib/nav-sections";

export function ComponentDetailScreen({ section, slug }: { section: SectionSlug; slug: string }) {
  const ScreenComponent = DOC_SCREENS[section][slug];
  if (!ScreenComponent) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-on-surface-muted">No doc screen registered for &quot;{slug}&quot;.</Text>
      </View>
    );
  }
  return <ScreenComponent />;
}
