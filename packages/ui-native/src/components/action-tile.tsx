import { useState } from "react";
import { Pressable, Text } from "react-native";

/**
 * An icon + label tile, tinted rounded box — for a wrapping grid of
 * equal-width quick actions/shortcuts. Originally built for
 * `apps/showcase-native`'s Home screen ("Quick actions": New quote/Log
 * expense/Add photo/New job) — extracted here since the tile itself has
 * no dashboard-specific logic; the specific action list and the grid's own
 * `flex-wrap` layout stay screen-local.
 *
 * **A real, fixed gap found during extraction, not present in the
 * original: `onPress` is now a real, required prop.** The original inline
 * version rendered a plain `View` with no `onPress`/`accessibilityRole` at
 * all — visually a tappable-looking tinted box that did nothing when
 * pressed, since "Quick actions" implies the tiles are actionable. Fixed
 * here by using `Pressable` with a real `onPress` and
 * `accessibilityRole="button"` — any future consumer gets a genuinely
 * tappable tile by construction, not by remembering to wrap one.
 *
 * **Pressed-state opacity is tracked via local `useState`, NOT
 * `Pressable`'s own `style={({ pressed }) => ({...})}` callback form —
 * see `full-width-button.tsx`'s own doc comment for the confirmed, real
 * bug this avoids: that callback form rendered with NO styling applied at
 * all on a real device in this exact app (suspected NativeWind babel-
 * interop interaction with a bare `Pressable`), even though it's standard,
 * documented RN usage. This component follows the same safe pattern that
 * fixed it there.**
 */
export interface ActionTileProps {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  /** The icon's tint color — this component has no `Host`/native theming bridge of its own (plain NativeWind styling), so the caller resolves it from `useNativeColors()`, matching every other NativeWind-styled icon usage in this package's consumers. */
  iconColor: string;
  disabled?: boolean;
  testID?: string;
}

export function ActionTile({ label, icon: Icon, onPress, iconColor, disabled = false, testID }: ActionTileProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      className="items-center justify-center gap-2 rounded-xl bg-info-bg py-4 dark:bg-info-bg-dark"
      style={{ width: "22%", flexGrow: 1, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }}
    >
      <Icon size={20} color={iconColor} />
      <Text className="text-[12px] font-medium text-on-surface dark:text-on-surface-dark">{label}</Text>
    </Pressable>
  );
}
