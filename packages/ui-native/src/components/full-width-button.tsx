import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { Button as ComposeButton, OutlinedButton, Shape, Text as ComposeText, type ShapeJSXElement } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, testID as testIDModifier } from "@expo/ui/jetpack-compose/modifiers";
import { Host } from "@expo/ui";
import { useNativeHostTheme, useNativeColors } from "../theme/use-native-colors";
import type { ButtonControlSize, ButtonVariant } from "./button";

/**
 * A genuinely full-width native button — `Button` (this package's default,
 * content-sized native `@expo/ui` button) has NO working `fullWidth`
 * option, and this component exists specifically because that turned out
 * to be a real, confirmed upstream `@expo/ui` limitation, not something
 * fixable by a prop on `Button` itself. Read this doc comment in full
 * before touching either component again.
 *
 * **Full investigation trail (so the next person doesn't repeat it):**
 * 1. `style={{ width: "100%" }}` on `Button` — does nothing. Both
 *    `transformStyle.ios.ts` and `.android.ts` (the universal `style`→
 *    modifier translators `Button` uses) force-cast `style.width as
 *    number` with zero runtime validation, then hand it straight to a
 *    native `CGFloat?`/`Dp` field — there is no percentage-width concept
 *    anywhere in that layer, so `"100%"` silently fails to parse and
 *    produces no visible change at all.
 * 2. A flexible `frame({ maxWidth: Infinity })` via the `modifiers` escape
 *    hatch — `Infinity` doesn't survive the bridge (confirmed via a debug
 *    render: it arrives on the native side as `maxWidth: null`, since
 *    something in the RN-bridge prop-serialization path round-trips
 *    through `JSON.stringify`, which turns `Infinity` into `null`).
 * 3. `frame({ maxWidth: Number.MAX_VALUE })` (a real finite stand-in for
 *    infinity) — survives the bridge correctly this time, but STILL
 *    doesn't visually stretch the button. A small FIXED `frame({ width:
 *    60, height: 60 })` on the same component DID visibly clamp/truncate
 *    it ("Sa…"), proving `modifiers`/`frame` genuinely reaches native code
 *    — so the issue is specific to SwiftUI's `.buttonStyle(.borderedProminent)`:
 *    it paints its own pill background sized to the LABEL's own content,
 *    independent of an outer `.frame(width:)` on the `Button` view itself.
 *    An outer frame can constrain the invisible layout/tap-target box, but
 *    it does not force the already-content-sized pill to visually grow.
 * 4. Even a real MEASURED fixed pixel width (via `onLayout` on a `w-full`
 *    wrapping `View`, ruling out any percentage/serialization issue
 *    entirely) — still no visible stretch. Confirms this isn't a units or
 *    bridge-serialization problem at all; it's `.buttonStyle`'s own
 *    background-sizing behavior.
 *
 * **The actual fix**: apply the `frame`/`fillMaxWidth` modifier to the
 * button's LABEL CONTENT instead of to the `Button` view from the
 * outside. On iOS, this means using `@expo/ui/swift-ui`'s `Button`
 * directly (not the universal cross-platform wrapper `Button` uses) with
 * a `swift-ui/Text` as `children`, carrying its own `frame({ maxWidth,
 * alignment: "center" })` modifier — SwiftUI's `.buttonStyle` sizes its
 * background to fit whatever content it's given, so a full-width LABEL
 * naturally produces a full-width pill. On Android, Jetpack Compose's
 * `Button` doesn't have this content-vs-background split at all — a
 * `fillMaxWidth()` modifier applied directly to the `Button` itself
 * already stretches it correctly (Compose's own `Button` sizes its
 * Surface from the modifier chain passed to the Button, not independently
 * from its content) — so Android needs no equivalent workaround.
 *
 * Deliberately narrower than `Button`: no `children`/custom content (text
 * label only, via `label`), and no `ghost`/`text` variant (a full-width
 * borderless/plain button reads as an empty tap zone with no visual
 * affordance for its own bounds — not a real design case here). Add
 * these only if a real call site needs them.
 *
 * **A user-reported iOS-vs-Android spacing difference around this
 * component was investigated at length; read this before "fixing" it
 * again.** A debug-colored wrapper `View` placed around a real on-device
 * `Host` showed Android's box hugging its visible pill tightly on every
 * side, while iOS's box extends some real amount PAST the visible pill's
 * bottom edge (SwiftUI reserves layout space to satisfy Apple's 44pt
 * minimum tap-target height for `.borderedProminent` buttons — confirmed
 * NOT affected by `controlSize` or `shape`/`buttonBorderShape`).
 *
 * **A first attempt to compensate for this with a fixed `marginBottom` on
 * the iOS `Host` wrapper (measured from a single-pixel-column screenshot
 * sample) was WRONG and made things WORSE — it overshot and caused a real,
 * visible overlap between this button and the next one (rounded corners
 * clipping into each other), confirmed via a user screenshot, then
 * reverted.** The single-column pixel sample that produced that number
 * significantly overestimated the safe correction — rounded-corner button
 * shapes overlap much more visibly near their curved edges than at
 * dead-center, which a single vertical sample column entirely misses. Do
 * not reintroduce a hardcoded negative-margin compensation without: (1)
 * measuring across the FULL width of the button, not one column, in a
 * real end-to-end scrolled screenshot (not a cropped/partial one), and (2)
 * confirming zero overlap at both the leftmost and rightmost rounded
 * corners specifically, where overlap is most visible. As shipped, this
 * component applies NO compensation — the raw `Host` box (including its
 * invisible tap-target slack) is what callers space against, matching the
 * platform's own accessibility-mandated sizing rather than fighting it.
 *
 * **A second, separate real bug eventually retired the `@expo/ui`
 * `Host`/`swift-ui Button` approach on iOS entirely: on first render, the
 * space ABOVE this button was completely missing, then snapped into place
 * — the button visibly "jumped down" — the first time it was pressed.**
 * Root-caused by reading `@expo/ui`'s own native source (`RNHostView.swift`):
 * `Host`'s `matchContents` reports the true SwiftUI content size back to the
 * RN shadow tree ASYNCHRONOUSLY, via `ReportSizeToYogaNodeModifier`'s
 * `.onGeometryChange`/`.onChange(of: geometry.size)`, which only fires AFTER
 * the first native layout pass — so on mount, Yoga briefly lays out this
 * `Host` (and its RN siblings, including the gap above it) using a
 * stale/undersized height, which only visibly corrects once something
 * forces an RN-side re-layout (exactly what a tap's state update does,
 * hence "fixes itself on the first press"). A `setTimeout`-driven forced
 * re-render shortly after mount was tried as a workaround and did NOT
 * reliably fix it in practice (the native geometry callback's actual
 * arrival time isn't bounded by a fixed JS timer) — see this file's git
 * history for that attempt and why it was abandoned rather than the real
 * fix.
 *
 * **The actual fix, on iOS only: this component no longer uses `@expo/ui`'s
 * `Host`/`swift-ui Button` at all — it's a plain RN `Pressable` (see
 * `IOSFullWidthButton` below) styled to visually approximate SwiftUI's
 * `.borderedProminent`/`.bordered` look (solid/outlined pill, dimmed
 * opacity while pressed).** This trades genuine native button
 * material/press animation for fully synchronous RN/Yoga layout with no
 * native-geometry round-trip to race against — the root cause above simply
 * doesn't exist for a plain `Pressable`. Colors come from `useNativeColors()`
 * (the same plain hex-token hook `Button`/other `@expo/ui`-backed components
 * already use for their `Host.seedColor`), applied via inline `style` since
 * there's no `Host` theming bridge to lean on here. Android is UNCHANGED —
 * still the real `@expo/ui/jetpack-compose` `Button`/`OutlinedButton` with
 * `fillMaxWidth()`, which was never affected by this bug (Android's `Host`
 * box hugs its visible content tightly with no equivalent async
 * geometry-report timing gap, per the investigation above). `controlSize`
 * is now applied as a plain padding/height/font-size scale (see
 * `IOS_CONTROL_SIZE_STYLE` below) rather than SwiftUI's real `controlSize`
 * modifier, since there's no native control to forward it to anymore.
 *
 * **`IOSFullWidthButton` tracks its own pressed state with `useState` and
 * computes a plain (non-function) `style` object, rather than `Pressable`'s
 * own `style={({ pressed }) => ({...})}` callback form.** The callback form
 * was tried first and rendered with NO styling applied at all on a real
 * device — no background, no padding, no alignment, just bare text —
 * confirmed via an actual on-device screenshot, not just a code-read, even
 * though that's standard, documented RN usage. Not fully root-caused, but
 * the leading suspect is this app's `babel.config.js` running every JSX
 * element (including a bare `Pressable` with no `className` at all)
 * through NativeWind's `nativewind/babel` interop wrapper — every other
 * native-styling mechanism already used elsewhere in this file (`@expo/ui`'s
 * own `modifiers` arrays) sits outside that interop path entirely, and this
 * was the first plain-RN-primitive `style` callback added to this
 * package's `@expo/ui`-backed component set. See `IOSFullWidthButton`'s own
 * comment for the same note, kept next to the actual code.
 */
export interface FullWidthButtonProps {
  variant?: Exclude<ButtonVariant, "ghost">;
  disabled?: boolean;
  onPress?: () => void;
  label: string;
  testID?: string;
  /**
   * On Android, still forwarded to `@expo/ui/jetpack-compose`'s real Button
   * — see `Button`'s own doc comment for the full rationale on that native
   * mechanism. **On iOS, this is now a plain RN padding/height/font-size
   * scale** (`IOS_CONTROL_SIZE_STYLE` below), not SwiftUI's real
   * `controlSize` modifier — see this file's own doc comment for why iOS
   * moved off `@expo/ui`'s `Host`/`swift-ui Button` entirely. Visually
   * approximates the same relative sizing, not a pixel-identical match to
   * SwiftUI's own metrics. Defaults to `"regular"`.
   */
  controlSize?: ButtonControlSize;
  /**
   * `"pill"` (default, unchanged) on both platforms. On Android, still
   * `@expo/ui/jetpack-compose`'s own `Button`/`OutlinedButton` `shape` prop
   * (a real `Shape.RoundedCorner`/`Shape.Rectangle` value, since this
   * component already uses the direct Compose `Button` rather than the
   * universal wrapper `Button` is limited to). **On iOS, this is now a
   * plain RN `borderRadius` on the `Pressable` itself** — see this file's
   * own doc comment for why iOS moved off `@expo/ui`'s `Host`/`swift-ui
   * Button` entirely; there's no `buttonBorderShape` modifier to forward to
   * anymore, just a real style property.
   *
   * **`Shape.RoundedCorner`/`Shape.Rectangle`/`Shape.Pill` must be CALLED
   * as plain functions (`Shape.RoundedCorner({...})`), never rendered as
   * JSX (`<Shape.RoundedCorner ... />`) — a real, confirmed bug, not a
   * style preference.** Per Expo's own docs
   * (docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/button), `shape`
   * is a value produced by calling the function directly. Using JSX syntax
   * for the exact same component was tried first here and broke Android
   * rendering completely — the whole Button silently vanished, no crash
   * log, no JS error — reproduced with every `Shape` variant, including a
   * bare `<Shape.Pill />` with no props at all. See `androidShapeElement`'s
   * own comment below for the full account.
   */
  shape?: "pill" | "rounded" | "sharp";
}

const VARIANT_TO_EXPO_UI_VARIANT: Record<Exclude<ButtonVariant, "ghost">, "filled" | "outlined"> = {
  primary: "filled",
  secondary: "outlined",
  danger: "filled",
};

const ROUNDED_CORNER_RADIUS = 10;

// Plain RN sizing scale approximating SwiftUI's real `controlSize` metrics
// closely enough for this button's own use — see this file's own doc
// comment for why iOS no longer forwards a real native `controlSize`
// modifier. Not a pixel-identical match to SwiftUI's own values.
const IOS_CONTROL_SIZE_STYLE: Record<ButtonControlSize, { paddingVertical: number; fontSize: number }> = {
  mini: { paddingVertical: 4, fontSize: 13 },
  small: { paddingVertical: 6, fontSize: 14 },
  regular: { paddingVertical: 11, fontSize: 17 },
  large: { paddingVertical: 14, fontSize: 19 },
  extraLarge: { paddingVertical: 18, fontSize: 22 },
};

// Per Expo's own docs (docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/button),
// `shape` is constructed by CALLING `Shape.RoundedCorner({...})` as a plain
// function — NOT rendered as JSX (`<Shape.RoundedCorner ... />`). This matters:
// JSX syntax for the exact same component was tried first and broke Android
// rendering entirely (the whole Button silently disappeared, no crash log, no
// JS error — reproduced with every Shape variant, including a bare
// `<Shape.Pill />`), while calling it directly per the docs' own example works.
function androidShapeElement(shape: "pill" | "rounded" | "sharp"): ShapeJSXElement | undefined {
  switch (shape) {
    case "rounded":
      return Shape.RoundedCorner({
        cornerRadii: {
          topStart: ROUNDED_CORNER_RADIUS,
          topEnd: ROUNDED_CORNER_RADIUS,
          bottomStart: ROUNDED_CORNER_RADIUS,
          bottomEnd: ROUNDED_CORNER_RADIUS,
        },
      });
    case "sharp":
      return Shape.Rectangle({ cornerRounding: 0 });
    case "pill":
      return undefined;
  }
}

// A separate component (not inlined in `FullWidthButton`'s iOS branch) so
// the pressed-state visual can be tracked with plain local state and
// applied via a normal, non-function `style` object — `Pressable`'s own
// function-style `style={({ pressed }) => ({...})}` prop was tried first
// here and rendered with NO styling applied at all on a real device (no
// background, no padding, no alignment — confirmed via a real screenshot,
// not just a code-read), even though the exact same pattern is standard,
// documented RN usage. Root cause not fully isolated, but this app's
// `babel.config.js` runs every JSX element (including bare `Pressable`,
// with no `className` at all) through NativeWind's `nativewind/babel`
// interop wrapper — the leading suspect, given every other native-styling
// mechanism already used elsewhere in this file (`@expo/ui`'s own
// `modifiers` arrays) sits outside that interop path entirely, and this is
// the first plain-RN-primitive `style` callback added to this package's
// `@expo/ui`-backed component set. Computing the style as a plain object
// from local `pressed` state sidesteps whatever the actual interaction is,
// without needing to fully diagnose NativeWind's interop internals.
function IOSFullWidthButton({
  onPress,
  disabled,
  testID,
  label,
  fillColor,
  labelColor,
  filled,
  controlSize,
  shape,
}: {
  onPress?: () => void;
  disabled: boolean;
  testID?: string;
  label: string;
  fillColor: string;
  /** Text on the filled button: `onPrimary` / `onDanger` for this mode (US-OPS-25). */
  labelColor: string;
  filled: boolean;
  controlSize: ButtonControlSize;
  shape: "pill" | "rounded" | "sharp";
}) {
  const [pressed, setPressed] = useState(false);
  const sizeStyle = IOS_CONTROL_SIZE_STYLE[controlSize];
  const borderRadius = shape === "sharp" ? 0 : shape === "rounded" ? ROUNDED_CORNER_RADIUS : 9999;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={{
        borderRadius,
        paddingVertical: sizeStyle.paddingVertical,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        ...(filled ? { backgroundColor: fillColor } : { backgroundColor: "transparent", borderWidth: 1, borderColor: fillColor }),
      }}
    >
      <Text
        style={{
          fontSize: sizeStyle.fontSize,
          fontWeight: "600",
          // US-OPS-25 (D-099): white on the light-mode fill, near-black on
          // the lighter dark-mode fill — white on #6B8AFF is only 3.1:1.
          color: filled ? labelColor : fillColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FullWidthButton({
  variant = "primary",
  disabled = false,
  onPress,
  label,
  testID,
  controlSize,
  shape = "pill",
}: FullWidthButtonProps) {
  const colors = useNativeColors();
  const seedColor = variant === "danger" ? colors.overdue : undefined;
  const hostTheme = useNativeHostTheme(seedColor);
  const expoUiVariant = VARIANT_TO_EXPO_UI_VARIANT[variant];

  if (Platform.OS === "ios") {
    return (
      <IOSFullWidthButton
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        label={label}
        labelColor={variant === "danger" ? colors.onDanger : colors.onPrimary}
        fillColor={seedColor ?? colors.primary}
        filled={expoUiVariant === "filled"}
        controlSize={controlSize ?? "regular"}
        shape={shape}
      />
    );
  }

  const AndroidButtonComponent = expoUiVariant === "filled" ? ComposeButton : OutlinedButton;
  // Exact Spine colours (D-099): a Host seed colour alone makes Material
  // derive its own tonal palette, so the fill came out muted purple/brown
  // instead of primary/overdue on a real device (Phase 5, US-MOB-20).
  const fill = seedColor ?? colors.primary;
  const androidColors = expoUiVariant === "filled" ? { containerColor: fill, contentColor: variant === "danger" ? colors.onDanger : colors.onPrimary } : { contentColor: fill };

  return (
    <Host matchContents={{ vertical: true, horizontal: false }} colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <AndroidButtonComponent
        onClick={disabled ? undefined : onPress}
        enabled={!disabled}
        shape={androidShapeElement(shape)}
        colors={androidColors}
        modifiers={[fillMaxWidth(), ...(testID ? [testIDModifier(testID)] : [])]}
      >
        <ComposeText>{label}</ComposeText>
      </AndroidButtonComponent>
    </Host>
  );
}
