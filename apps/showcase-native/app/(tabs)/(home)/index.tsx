import { Platform, ScrollView, Text, View } from "react-native";
import { ScrollEdgeMask } from "@spine/ui-native";

/**
 * Real scrollable content, needed to verify the "full-bleed scrollable
 * viewport with blur at top/bottom" requirement from Phase 3: on iOS, the
 * blur comes for free from `react-native-screens`' `scrollEdgeEffects`
 * (default `"automatic"` on iOS 26+, see `(home)/_layout.tsx`'s own doc
 * comment) — no mask component needed there. Android has no such native
 * blur, so `ScrollEdgeMask` fades to the background color at the bottom
 * edge instead.
 *
 * `contentInsetAdjustmentBehavior="automatic"` is REQUIRED here — see this
 * file's own git history / `(home)/_layout.tsx`'s doc comment for the real,
 * reproduced bug (large-title header text rendering over this screen's
 * content) that omitting it causes under `headerLargeTitleEnabled`.
 */
export default function HomeScreen() {
  const rows = Array.from({ length: 30 }, (_, i) => i);

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-2 p-4"
        contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 16 }}
      >
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
