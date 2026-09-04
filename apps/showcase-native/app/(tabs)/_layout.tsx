import { Tabs } from "expo-router";

/**
 * Placeholder tab layout for Phase 0 (scaffold + toolchain verification
 * only) — uses expo-router's stable `Tabs`. Phase 3 replaces this with
 * `unstable-native-tabs`'s `NativeTabs` for genuine native chrome
 * (Liquid Glass iOS / Material bottom nav Android), per the approved plan.
 */
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
    </Tabs>
  );
}
