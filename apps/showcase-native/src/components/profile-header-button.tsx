import { Pressable } from "react-native";
import { Avatar } from "@spine/ui-native";
import { useProfileSheet } from "../lib/profile-sheet-context";

/**
 * The header-right avatar icon every tab's own `_layout.tsx` renders,
 * opening the Profile `<Modal>` via `useProfileSheet().open()` — NOT
 * `router.push`. Profile is a plain modal component controlled by React
 * state, not a routed screen at all — see `profile-sheet-context.tsx`'s
 * own doc comment for why (a real, severe bug the routed version hit that
 * this structural change sidesteps entirely). Identical on both
 * platforms — same avatar, same sheet, per the user's explicit choice not
 * to diverge Android's pattern from iOS's here (unlike the Search tab,
 * which genuinely has no shared native concept to converge on).
 */
export function ProfileHeaderButton() {
  const { open } = useProfileSheet();
  return (
    <Pressable onPress={open} hitSlop={8}>
      <Avatar fallback="SP" size="sm" />
    </Pressable>
  );
}
