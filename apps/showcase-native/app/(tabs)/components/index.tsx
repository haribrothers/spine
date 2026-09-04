import { View, Text } from "react-native";

/** Phase 5 fleshes this out into the real component-catalog list. */
export default function ComponentsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-lg font-semibold text-on-surface dark:text-on-surface-dark">Components</Text>
      <Text className="mt-1 text-on-surface-muted dark:text-on-surface-muted-dark">Catalog coming in Phase 5</Text>
    </View>
  );
}
