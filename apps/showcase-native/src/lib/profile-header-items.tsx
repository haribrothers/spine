import { Alert, Platform, Pressable, View } from "react-native";
import BellIcon from "lucide-react-native/icons/bell";
import { Avatar } from "@spine/ui-native";
import { useProfileSheet } from "./profile-sheet-context";
import { ProfileHeaderButton } from "../components/profile-header-button";

/**
 * Builds this tab's `headerRight`/`unstable_headerRightItems` — every tab
 * layout calls this instead of hand-writing the platform branch itself.
 * See `(home)/_layout.tsx`'s own doc comment for the full rationale on why
 * iOS gets two separate pill-shaped groups (`unstable_headerRightItems`
 * with `hidesSharedBackground: true`, a real user-reported requirement
 * matching an iOS 26 reference screenshot) while Android keeps one plain
 * row (no Material equivalent to that glass-pill-grouping concept exists).
 *
 * `includeBell` is per-screen, not global — only Home shows the
 * notifications bell; every other tab shows just the profile avatar.
 *
 * A HOOK, not a plain function — it calls `useProfileSheet()` internally
 * (Profile opens via that context's `open()`, not `router.push`, since
 * Profile is a plain `<Modal>` now, not a routed screen — see
 * `profile-sheet-context.tsx`'s own doc comment). Every call site is
 * already inside a `_layout.tsx` component's render body, a valid
 * hook-calling context.
 */
export function useProfileHeaderOptions(colors: { onSurface: string }, includeBell: boolean) {
  const { open } = useProfileSheet();

  if (Platform.OS === "ios") {
    return {
      unstable_headerRightItems: () => [
        ...(includeBell
          ? [
              {
                type: "custom" as const,
                hidesSharedBackground: true,
                element: (
                  <Pressable onPress={() => Alert.alert("Notifications", "You're all caught up — no new notifications.")} hitSlop={8}>
                    <BellIcon size={20} color={colors.onSurface} />
                  </Pressable>
                ),
              },
            ]
          : []),
        {
          type: "custom" as const,
          hidesSharedBackground: true,
          element: (
            <Pressable onPress={open} hitSlop={8}>
              <Avatar fallback="SP" size="sm" />
            </Pressable>
          ),
        },
      ],
    };
  }

  return {
    headerRight: () =>
      includeBell ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable onPress={() => Alert.alert("Notifications", "You're all caught up — no new notifications.")} hitSlop={8}>
            <BellIcon size={22} color={colors.onSurface} />
          </Pressable>
          <ProfileHeaderButton />
        </View>
      ) : (
        <ProfileHeaderButton />
      ),
  };
}
