import { Platform } from "react-native";
import { Button as SwiftUIButton } from "@expo/ui/swift-ui";
import { buttonBorderShape, buttonStyle, controlSize as iosControlSize, disabled as iosDisabled, frame } from "@expo/ui/swift-ui/modifiers";
import { Text as SwiftUIText } from "@expo/ui/swift-ui";
import { Button as ComposeButton, OutlinedButton, Shape, Text as ComposeText, type ShapeJSXElement } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
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
 */
export interface FullWidthButtonProps {
  variant?: Exclude<ButtonVariant, "ghost">;
  disabled?: boolean;
  onPress?: () => void;
  label: string;
  testID?: string;
  /**
   * SwiftUI's real `controlSize` modifier — see `Button`'s own doc comment
   * for the full rationale. **iOS-only, a genuine no-op on Android**:
   * Jetpack Compose has no equivalent named-size concept here either.
   * Defaults to `"regular"` (omitted = `@expo/ui`'s own default, unchanged).
   */
  controlSize?: ButtonControlSize;
  /**
   * `"pill"` (default, unchanged) is `@expo/ui`'s real native Button shape
   * on both platforms. Unlike `Button` (whose `shape` prop is iOS-only —
   * see that component's own doc comment for why), `FullWidthButton`
   * supports `"rounded"`/`"sharp"` on BOTH platforms with a real, confirmed
   * mechanism per platform: iOS uses SwiftUI's `buttonBorderShape` modifier
   * (which changes what `.buttonStyle` actually PAINTS — a genuinely
   * different, working mechanism from `clipShape`, which was tried
   * elsewhere in this codebase's history and only crops after-the-fact
   * without changing the painted shape); Android uses
   * `@expo/ui/jetpack-compose`'s own `Button`/`OutlinedButton` `shape` prop
   * (a real `Shape.RoundedCorner`/`Shape.Rectangle` value, since this
   * component already uses the direct Compose `Button` rather than the
   * universal wrapper `Button` is limited to).
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

const IOS_BUTTON_STYLE: Record<"filled" | "outlined", "borderedProminent" | "bordered"> = {
  filled: "borderedProminent",
  outlined: "bordered",
};

// A real, finite stand-in for `Infinity`, which does not survive the
// `@expo/ui` prop bridge (see this file's own doc comment, investigation
// step 2) — functionally identical to infinite `maxWidth` on any real
// device screen size.
const MAX_FLEXIBLE_WIDTH = Number.MAX_VALUE;

const ROUNDED_CORNER_RADIUS = 10;

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
    const shapeModifier =
      shape === "rounded"
        ? buttonBorderShape("roundedRectangle", ROUNDED_CORNER_RADIUS)
        : shape === "sharp"
          ? buttonBorderShape("roundedRectangle", 0)
          : undefined;

    return (
      <Host matchContents={{ vertical: true, horizontal: false }} colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
        <SwiftUIButton
          onPress={onPress}
          modifiers={[
            buttonStyle(IOS_BUTTON_STYLE[expoUiVariant]),
            iosDisabled(disabled),
            ...(controlSize ? [iosControlSize(controlSize)] : []),
            ...(shapeModifier ? [shapeModifier] : []),
          ]}
          testID={testID}
        >
          <SwiftUIText modifiers={[frame({ maxWidth: MAX_FLEXIBLE_WIDTH, alignment: "center" })]}>{label}</SwiftUIText>
        </SwiftUIButton>
      </Host>
    );
  }

  const AndroidButtonComponent = expoUiVariant === "filled" ? ComposeButton : OutlinedButton;

  return (
    <Host matchContents={{ vertical: true, horizontal: false }} colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <AndroidButtonComponent
        onClick={disabled ? undefined : onPress}
        enabled={!disabled}
        shape={androidShapeElement(shape)}
        modifiers={[fillMaxWidth()]}
      >
        <ComposeText>{label}</ComposeText>
      </AndroidButtonComponent>
    </Host>
  );
}
