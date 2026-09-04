import { Button as ExpoButton, Host } from "@expo/ui";
import { useNativeHostTheme, useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s universal `Button` — real SwiftUI `Button`/Jetpack Compose
 * `Button` via a `Host` bridge, replacing the previous NativeWind/`cva`
 * implementation (Pressable/Text styled via classNames) entirely. This is a
 * full replace, not an addition — there is no NativeWind fallback path.
 *
 * `variant` maps to `@expo/ui`'s own three variants (`filled`/`outlined`/
 * `text`), collapsing the old four-variant set (`primary`/`secondary`/
 * `danger`/`ghost`): `danger` is now `filled` with an `overdue`-seeded
 * `Host` (color, not a distinct visual style, carries the destructive
 * meaning — matching how a native OS button conveys "destructive" via tint
 * rather than a different shape), and `secondary`/`ghost` both map to
 * `outlined`/`text` since RN has no equivalent of a bordered-vs-borderless
 * secondary action distinct from what `@expo/ui` already offers.
 *
 * Color is NOT threaded through a per-component prop — confirmed against
 * `ButtonProps`'s real TS type, which has no `color`/`tint` field at all;
 * `@expo/ui`'s own theming mechanism is `Host`'s `seedColor`, which themes
 * the whole native subtree (real SwiftUI tint propagation on iOS, real
 * Material You `SchemeTonalSpot` generation on Android) — see
 * `useNativeHostTheme` in `theme/use-native-colors.ts`.
 *
 * `size`/`loading` have no `@expo/ui` equivalent: `size` doesn't exist as a
 * concept in the native Button API (native controls have one standard
 * size), and `loading` has no built-in spinner-replaces-label affordance —
 * both are dropped rather than faked. A future loading affordance should
 * disable the button and swap `label`/`children` for a `Spinner`
 * (`packages/ui-native`'s own non-native component) rather than trying to
 * reproduce `ActivityIndicator`-in-a-button, which was specific to the old
 * Pressable-based implementation.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_TO_EXPO_UI_VARIANT: Record<ButtonVariant, "filled" | "outlined" | "text"> = {
  primary: "filled",
  secondary: "outlined",
  danger: "filled",
  ghost: "text",
};

export interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  label?: string;
  testID?: string;
}

export function Button({ variant = "primary", disabled = false, onPress, children, label, testID }: ButtonProps) {
  const colors = useNativeColors();
  const seedColor = variant === "danger" ? colors.overdue : undefined;
  const hostTheme = useNativeHostTheme(seedColor);

  return (
    <Host matchContents colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <ExpoButton variant={VARIANT_TO_EXPO_UI_VARIANT[variant]} disabled={disabled} onPress={onPress} testID={testID} label={!children ? label : undefined}>
        {children}
      </ExpoButton>
    </Host>
  );
}
