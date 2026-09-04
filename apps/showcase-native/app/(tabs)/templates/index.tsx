import { View, Text } from "react-native";

/** Phase 5 fleshes this out into real full-page template examples. */
export default function TemplatesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-lg font-semibold text-on-surface dark:text-on-surface-dark">Templates</Text>
      <Text className="mt-1 text-on-surface-muted dark:text-on-surface-muted-dark">Templates coming in Phase 5</Text>
    </View>
  );
}
