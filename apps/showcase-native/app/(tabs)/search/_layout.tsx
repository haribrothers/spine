import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useProfileHeaderOptions } from "../../../src/lib/profile-header-items";

/**
 * `headerLargeTitleEnabled` (iOS), matching `(home)`/`components`/
 * `templates` — a real, user-requested reversal of this file's own earlier
 * decision to skip large title here. The earlier rationale (a plain small
 * header avoids ever hitting the large-title "ScrollView must be the
 * direct root" collapse-tracking bug, since this screen's `FlatList` sat
 * alongside a sibling search-field `View`) is addressed at the SCREEN
 * level instead of by avoiding large title altogether — `index.tsx` now
 * renders exactly one `FlatList` as its direct root at all times (results,
 * recent searches, and the empty state are all just different `data`/
 * `ListHeaderComponent`/`ListEmptyComponent` values on that SAME list
 * instance, never three separately-mounted trees), so the large-title
 * collapse tracker always has a single, stable scroll view to attach to —
 * see `index.tsx`'s own doc comment for the full rationale.
 */
export default function SearchLayout() {
  const colors = useNativeColors();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Search",
          ...(Platform.OS === "ios" ? { headerLargeTitleEnabled: true } : null),
          ...useProfileHeaderOptions(colors, false),
        }}
      />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
