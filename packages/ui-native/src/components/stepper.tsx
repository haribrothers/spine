import { Pressable, Text, View } from "react-native";
import MinusIcon from "lucide-react-native/icons/minus";
import PlusIcon from "lucide-react-native/icons/plus";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * A numeric +/- stepper — the SAME custom `-`/value/`+` row on BOTH
 * platforms, using `lucide-react-native`'s `Minus`/`Plus` icons (the same
 * icon library every other in-content icon in this app already uses, per
 * this package's own icon-library rule).
 *
 * **This deliberately does NOT use `@expo/ui`'s real native SwiftUI
 * `Stepper` on iOS, even though one exists — an explicit, requested choice,
 * not an oversight.** `@expo/ui/swift-ui`'s `Stepper` was tried first and
 * reverted: real native chrome, but Jetpack Compose has NO built-in stepper
 * control at ALL (confirmed: no `@expo/ui/jetpack-compose` export exists
 * for one), so Android would have needed a custom design regardless. Using
 * `@expo/ui`'s real native `Stepper` on iOS but a custom one on Android
 * meant the two platforms visually diverged (SwiftUI's own `-`/value/`+`
 * pill shape vs. this component's own circular icon-button pair) — a real,
 * requested design correction to make both platforms match exactly,
 * choosing the custom design for iOS too rather than trying to reshape
 * SwiftUI's own native control to match a custom Android one.
 *
 * A real native Material Symbol (matching iOS's real SF Symbol bar) was
 * considered for Android's icons specifically, but requires bundling actual
 * `.xml` vector-drawable ASSET FILES plus a `metro.config.js` change
 * (registering `.xml` in `assetExts`, since Metro doesn't bundle `.xml` as
 * an asset by default) — `@expo/ui/jetpack-compose`'s `Icon` component has
 * no "pass a symbol name string" API the way iOS's SF Symbols do; it only
 * accepts a real bundled drawable via `require()`. Declined as
 * disproportionate infra for two icons; Lucide's `Minus`/`Plus` (already a
 * dependency, already used everywhere else in this app) on BOTH platforms
 * was chosen instead.
 */
export interface StepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  testID?: string;
}

export function Stepper({ value, onValueChange, min = 0, max = 100, step = 1, disabled = false, testID }: StepperProps) {
  const colors = useNativeColors();

  const canDecrement = !disabled && value - step >= min;
  const canIncrement = !disabled && value + step <= max;

  function decrement() {
    if (canDecrement) onValueChange(Math.max(min, value - step));
  }

  function increment() {
    if (canIncrement) onValueChange(Math.min(max, value + step));
  }

  return (
    <View className="flex-row items-center gap-3" testID={testID}>
      <Pressable
        onPress={decrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        accessibilityState={{ disabled: !canDecrement }}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full bg-surface-sunken dark:bg-surface-sunken-dark"
        style={{ opacity: canDecrement ? 1 : 0.4 }}
      >
        <MinusIcon size={16} color={colors.onSurface} />
      </Pressable>
      <Text className="min-w-[24px] text-center text-[15px] text-on-surface dark:text-on-surface-dark">{value}</Text>
      <Pressable
        onPress={increment}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        accessibilityState={{ disabled: !canIncrement }}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full bg-surface-sunken dark:bg-surface-sunken-dark"
        style={{ opacity: canIncrement ? 1 : 0.4 }}
      >
        <PlusIcon size={16} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}
