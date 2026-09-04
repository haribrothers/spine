import { Platform, ScrollView, Text, View } from "react-native";
import { ScrollEdgeMask } from "@spine/ui-native";

/**
 * Real scrollable content, needed to verify the "full-bleed scrollable
 * viewport with blur at top/bottom" requirement from Phase 3: on iOS, the
 * blur comes for free from `(home)/_layout.tsx`'s `headerTransparent`/
 * `headerBlurEffect` (top) and `NativeTabs`'s own default scroll-edge
 * transparency (bottom) — no mask component needed there. Android has no
 * such native blur, so `ScrollEdgeMask` fades to the background color at
 * the bottom edge instead (there's no scroll-edge transparency to fade
 * under at the top on Android either, since Android's header here is a
 * plain solid `TopAppBar`, not transparent — only the bottom, under the
 * Material tab bar, needs a mask).
 */
export default function HomeScreen() {
  const rows = Array.from({ length: 30 }, (_, i) => i);

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView contentContainerClassName="gap-2 p-4" contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 16 }}>
        {rows.map((i) => (
          <View key={i} className="rounded-lg border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
            <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">Row {i + 1}</Text>
          </View>
        ))}
      </ScrollView>
      {Platform.OS === "android" ? <ScrollEdgeMask edge="bottom" /> : null}
    </View>
  );
}
