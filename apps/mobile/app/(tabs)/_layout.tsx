import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useNativeColors } from "@spine/ui-native";

/**
 * US-MOB-19 / D-197 — native tabs: Today, Jobs and Expenses, plus Search.
 * iOS renders a real `UITabBar` (Liquid Glass) with Search as the tab bar's
 * own search button (`role="search"`); Android renders a Material
 * navigation bar where Search is an ordinary fourth tab. Icons are SF
 * Symbols / Material Symbols — the one place Lucide isn't used (see
 * apps/showcase-native's tab layout). Groups need `name="(group)"`
 * (docs/design/native-notes.md).
 */
export default function TabsLayout() {
  const colors = useNativeColors();

  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={{ default: colors.onSurfaceMuted, selected: colors.primary }}
      backgroundColor={colors.surfaceSunken}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="today" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jobs">
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
