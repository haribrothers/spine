import { View, Text } from "react-native";

/** Phase 0 placeholder — confirms the toolchain boots on a real device/simulator. */
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-lg font-semibold text-on-surface dark:text-on-surface-dark">Spine Showcase</Text>
      <Text className="mt-1 text-on-surface-muted dark:text-on-surface-muted-dark">Phase 0 — toolchain boot check</Text>
    </View>
  );
}
