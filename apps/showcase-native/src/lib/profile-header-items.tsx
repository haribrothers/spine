import { Alert, Platform, Pressable, View, type ImageSourcePropType } from "react-native";
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
 * directly.
 *
 * **Avatar keeps its own default blue `bg-primary` fill — it does NOT try
 * to match the bell's neutral gray/glass chrome color, a real reverted
 * mistake.** An earlier version of this fix overrode Avatar's background
 * with `surfaceSunken` (a light neutral gray) to visually pair with the
 * bell's native chrome, but that broke the fallback's hardcoded
 * `text-white` initials text in light mode specifically — white "SP" text
 * on `surfaceSunken`'s near-white light-mode value was nearly invisible
 * (confirmed live via screenshot: a real, user-reported regression, not a
 * cosmetic nitpick). Reverted: Avatar's own blue fill is correct here on
 * both themes (white text on blue always has enough contrast) — the bell
 * and avatar are simply two different-colored circles by design, the same
 * way Apple's own apps often pair a neutral icon button with a colored
 * profile photo/initial, and that's fine; only their SIZE needs to match,
 * not their color.
 *
 * **Sizing: an explicit `h-[42px] w-[42px]` override on Avatar's
 * `className`, not any of its existing `sm`/`md`/`lg` size variants — a
 * real, measured fix, not a guess.** The first attempt used `size="md"`
 * (32pt), assumed to visually match the native bell button's circle;
 * comparing actual rendered pixels (cropped screenshots, dark mode, with a
 * grid overlay and a per-pixel color-boundary scan) showed the real native
 * bell chrome renders at roughly 42pt (~127-131px in a 3x-scale
 * screenshot) — about 1.5x bigger than the 32pt avatar sat next to it, a
 * clearly visible, real mismatch matching the user's report. `size="md"`
 * is kept as the base (for its font-size/overflow/rounding classes) with
 * `className`'s `h-[42px] w-[42px]` winning over the base size's `h-8 w-8`
 * via `cn()`'s tailwind-merge (later class wins on the same property) —
 * this pattern (a `className` override on top of a component's own size
 * prop) is the same one already established elsewhere in this codebase,
 * not a new mechanism. If a future SF Symbol/native chrome size changes,
 * re-measure with the same pixel-scan approach rather than eyeballing it.
 *
 * `profileImageSource` (optional) is threaded through to `Avatar`'s own
 * `source` prop — `Avatar` already supports a real photo via `source:
 * ImageSourcePropType` (falls back to initials automatically on a missing
 * source or a load error), this just wires that existing capability up to
 * the header button specifically. No real user-profile-photo backend
 * exists in this showcase app yet (there's no auth/user-photo concept at
 * all here), so this is currently always called with no source and shows
 * the "SP" initials fallback — but the prop is real and ready for when a
 * caller has an actual photo URI/require(...) to pass.
 */
export function useProfileHeaderOptions(
  colors: { onSurface: string; surfaceSunken: string },
  includeBell: boolean,
  profileImageSource?: ImageSourcePropType,
) {
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
            <Pressable onPress={open} hitSlop={8} accessibilityLabel="Profile">
              <Avatar fallback="SP" size="md" source={profileImageSource} className="h-[42px] w-[42px]" />
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
