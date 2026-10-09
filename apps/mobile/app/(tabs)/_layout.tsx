import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useNativeColors } from "@spine/ui-native";
import { useModules } from "../../src/lib/data/modules";

/**
 * US-MOB-19 / D-197 — native tabs: Today, Jobs and Expenses, plus Search.
 * iOS renders a real `UITabBar` (Liquid Glass) with Search as the tab bar's
 * own search button (`role="search"`); Android renders a Material
 * navigation bar where Search is an ordinary fourth tab. Icons are SF
 * Symbols / Material Symbols — the one place Lucide isn't used (see
 * apps/showcase-native's tab layout). Groups need `name="(group)"`
 * (docs/design/native-notes.md). Jobs & field off hides the Jobs tab (D-198).
 */
export default function TabsLayout() {
  const colors = useNativeColors();
  const modules = useModules();
  const android = Platform.OS === "android";

  return (
    // Android: Material 3's navigation bar — surface-container, with the selected tab in a primary-container pill (US-MOB-20).
    <NativeTabs
      tintColor={android ? colors.onSurface : colors.primary}
      iconColor={{ default: colors.onSurfaceMuted, selected: android ? colors.onPrimaryContainer : colors.primary }}
      backgroundColor={android ? colors.surfaceContainer : colors.surfaceSunken}
      indicatorColor={colors.primaryContainer}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="today" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jobs" hidden={!modules.jobsField}>
        <NativeTabs.Trigger.Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} md="work" />
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} md="receipt_long" />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {Platform.OS === "ios" ? (
        <NativeTabs.Trigger name="search" role="search" />
      ) : (
        <NativeTabs.Trigger name="search">
          <NativeTabs.Trigger.Icon sf={{ default: "magnifyingglass", selected: "magnifyingglass" }} md="search" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}
