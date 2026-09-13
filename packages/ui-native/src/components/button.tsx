import { Platform } from "react-native";
import { Button as ExpoButton, Host } from "@expo/ui";
import { buttonBorderShape, controlSize as iosControlSize } from "@expo/ui/swift-ui/modifiers";
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

export type ButtonControlSize = "mini" | "small" | "regular" | "large" | "extraLarge";

export interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  label?: string;
  testID?: string;
  /**
   * SwiftUI's real `controlSize` modifier (`mini`/`small`/`regular`/
   * `large`/`extraLarge`) — adjusts the native control's own built-in
   * height/padding. **iOS-only, a genuine no-op on Android**: Jetpack
   * Compose has no equivalent named-size concept for `@expo/ui`'s Button
   * (only a raw `contentPadding` prop taking exact dp values, a
   * fundamentally different API shape) — same "real prop, iOS-only
   * effect" pattern as other SwiftUI-specific escape hatches already in
   * this codebase (e.g. `NativeTextField`'s `frame`-based sizing).
   * Defaults to `"regular"` — omitting this prop entirely (every existing
   * call site) keeps `@expo/ui`'s own default control size, unchanged.
   */
  controlSize?: ButtonControlSize;
  /**
   * `"pill"` (default, unchanged) is `@expo/ui`'s real native Button shape
   * on both platforms. `"rounded"`/`"sharp"` use SwiftUI's real
   * `buttonBorderShape` modifier on iOS (`roundedRectangle` with a fixed
   * corner radius, or `0` for true square corners) — this actually changes
   * the PAINTED shape of `.buttonStyle`'s background (confirmed distinct
   * from the earlier, failed `clipShape` attempt documented in
   * `full-width-button.tsx`'s own doc comment: `clipShape` crops
   * after-the-fact, `buttonBorderShape` changes what SwiftUI paints in the
   * first place).
   *
   * **iOS-only, a genuine no-op on Android for THIS component** — the
   * universal cross-platform `Button`/`ExpoButton` this file wraps has no
   * `shape` prop reachable through it on Android at all (confirmed against
   * `@expo/ui`'s own `universal/Button/index.android.tsx` and its
   * `ButtonProps` type — neither mentions `shape`). Jetpack Compose's
   * `Button` DOES support a real `shape` prop, but only via
   * `@expo/ui/jetpack-compose`'s OWN direct `Button` component, which is
   * what `FullWidthButton` uses directly (see that component for the real,
   * both-platforms-working version of this prop) — `Button` stays on the
   * simpler universal wrapper, so this is intentionally narrower here.
   */
  shape?: "pill" | "rounded" | "sharp";
}

const ROUNDED_CORNER_RADIUS = 10;

export function Button({ variant = "primary", disabled = false, onPress, children, label, testID, controlSize, shape = "pill" }: ButtonProps) {
  const colors = useNativeColors();
  const seedColor = variant === "danger" ? colors.overdue : undefined;
  const hostTheme = useNativeHostTheme(seedColor);

  // A bare string `children` (e.g. `<Button>Save</Button>`, the common
  // case) must go through `label`, NEVER passed as `children` directly to
  // `@expo/ui`'s native Button — confirmed as a real, reproduced crash on
  // a real device (`NSInternalInconsistencyException`: "ComponentView...
  // (`RawText`) not found"), since the native host view expects a
  // structured React element for custom `children`, not raw text Fabric
  // has to reconcile as its own component. `@expo/ui`'s own `children` doc
  // comment ("Custom content rendered inside the button") implies element
  // content, not a plain string — jest-expo's mock render never caught
  // this, since it doesn't perform real native-view reconciliation.
  const isPlainString = typeof children === "string";

  const iosModifiers =
    Platform.OS === "ios"
      ? [
          ...(controlSize ? [iosControlSize(controlSize)] : []),
          ...(shape === "rounded"
            ? [buttonBorderShape("roundedRectangle", ROUNDED_CORNER_RADIUS)]
            : shape === "sharp"
              ? [buttonBorderShape("roundedRectangle", 0)]
              : []),
        ]
      : undefined;
  const modifiers = iosModifiers?.length ? iosModifiers : undefined;

  return (
    <Host matchContents colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <ExpoButton
        variant={VARIANT_TO_EXPO_UI_VARIANT[variant]}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        label={isPlainString ? (children as string) : label}
        modifiers={modifiers}
      >
        {isPlainString ? undefined : children}
      </ExpoButton>
    </Host>
  );
}
