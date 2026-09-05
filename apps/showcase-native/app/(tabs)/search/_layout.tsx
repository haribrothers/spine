import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useProfileHeaderOptions } from "../../../src/lib/profile-header-items";

/**
 * No `headerLargeTitleEnabled` here, unlike `(home)`/`components`/
 * `templates` — this screen's primary control is the search field itself,
 * not a title, and a plain small header keeps this screen's own `View`
 * wrapper (needed so the `TextField` and `FlatList` are siblings, not the
 * `FlatList` alone as the screen's root) from ever hitting the large-title
 * "ScrollView must be the direct root" collapse-tracking bug documented in
 * `(home)/_layout.tsx`'s own doc comment — a plain (non-large) header has
 * no collapse animation to track in the first place.
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
      <Stack.Screen name="index" options={{ title: "Search", ...useProfileHeaderOptions(colors, false) }} />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
