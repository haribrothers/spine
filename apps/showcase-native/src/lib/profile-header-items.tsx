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
 *
 * **The bell is a real `type: "button"` native item, NOT `type: "custom"`
 * — a real, user-reported bug fix.** A reference screenshot of Apple's own
 * iOS 26 header buttons (a "•••" more-menu and a profile icon, each a true
 * glass-material circular button with its own soft depth/shadow) showed
 * our bell rendering as a bare flat icon with no button chrome at all —
 * because `type: "custom"` opts an item OUT of the native
 * `UIBarButtonItem` system entirely (per `expo-router`'s own
 * `NativeStackHeaderItemCustom` doc comment: it's "a custom item to
 * display any React Element," with no automatic background). `type:
 * "button"` with an SF Symbol `icon` (`{ type: "sfSymbol", name: "bell" }`)
 * is the genuine native item type, and gets Apple's real glass circular
 * chrome for free — no styling needed, since UIKit renders it. No
 * `hidesSharedBackground` on the bell itself (unlike the Avatar item below)
 * — it's the only native `"button"` item in this row, so there's no
 * sibling background to separate from in the first place; the flag matters
 * once two native items would otherwise merge into one shared pill.
 *
 * The Avatar profile button STAYS `type: "custom"` (a deliberate,
 * confirmed choice, not an oversight) — the real native button item only
 * accepts an SF Symbol or a static image as its `icon`, not an arbitrary
 * React element, so it can't render our dynamic "SP"-initials Avatar
 * directly. Since the initials bubble is this app's actual brand/identity
 * element (kept over swapping to a generic `person.crop.circle.fill` SF
 * Symbol, a real alternative that was explicitly considered and rejected),
 * it's wrapped in an explicit `surfaceSunken` circular background here to
 * visually approximate the native glass-pill chrome the bell now gets for
 * free — not pixel-identical to real `UIBarButtonItem` glass material
 * (custom items don't get the system's automatic background/blur), but
 * much closer than the previous bare, chrome-less `Pressable`.
 */
export function useProfileHeaderOptions(colors: { onSurface: string; surfaceSunken: string }, includeBell: boolean) {
  const { open } = useProfileSheet();

  if (Platform.OS === "ios") {
    return {
      unstable_headerRightItems: () => [
        ...(includeBell
          ? [
              {
                type: "button" as const,
                label: "Notifications",
                icon: { type: "sfSymbol" as const, name: "bell" as const },
                accessibilityLabel: "Notifications",
                onPress: () => Alert.alert("Notifications", "You're all caught up — no new notifications."),
              },
            ]
          : []),
        {
          type: "custom" as const,
          hidesSharedBackground: true,
          element: (
            <Pressable
              onPress={open}
              hitSlop={8}
              accessibilityLabel="Profile"
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.surfaceSunken }}
            >
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
