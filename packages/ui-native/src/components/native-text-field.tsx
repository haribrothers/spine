import { useEffect } from "react";
import { TextField as SwiftUITextField, Host, useNativeState } from "@expo/ui/swift-ui";
import { background, disabled as iosDisabled, font, frame, keyboardType as iosKeyboardType, padding, strokeBorder, textFieldStyle } from "@expo/ui/swift-ui/modifiers";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * A genuinely native iOS text field, built directly from Apple's own
 * SwiftUI `TextField` API (https://developer.apple.com/documentation/
 * swiftui/textfield) via `@expo/ui`'s SwiftUI bridge — iOS ONLY. There is
 * no Android branch: an earlier version of this component also covered
 * Android via Compose's Material3 `OutlinedTextField`, but was reverted
 * (undo the whole thing before rebuilding, not incrementally) per explicit
 * instruction to scope this to iOS alone. Do not add an Android branch
 * back without a separate, explicit request to do so.
 *
 * Additive, NOT a replacement for `TextField` (the existing NativeWind/
 * `cva`-styled `TextInput` wrapper, still the default field on every other
 * screen and on Android everywhere) — reach for `NativeTextField`
 * specifically where a screen wants iOS's own native field behavior
 * (real system text editing: native selection handles, real
 * cut/copy/paste/lookup menu, autofill, Live Text/QuickType, IME
 * composition) instead of RN's `TextInput` bridge.
 *
 * **Why `.textFieldStyle('plain')` + hand-drawn `background`/`strokeBorder`,
 * not `.textFieldStyle('roundedBorder')`** — confirmed against SwiftUI's
 * actual documented behavior, not a guess: `.roundedBorder` is a real,
 * built-in bordered style, but its border color is NOT independently
 * customizable — Apple provides no modifier for it, and the standard
 * workaround (used across SwiftUI reference material) is exactly what this
 * component does: `.plain` (no built-in chrome at all) plus your own
 * `background`/`strokeBorder`(`shape: 'roundedRectangle'`)/`cornerRadius`.
 * Since "the color system must be ours" was an explicit, non-negotiable
 * requirement here, `.plain` + hand-drawn chrome is the only path that
 * actually satisfies it — `.roundedBorder` cannot.
 *
 * **Color is threaded through explicitly, never left at the system
 * default** — `background`/`strokeBorder` resolve from this design
 * system's own tokens (`colors.surface`, `colors.borderStrong`/
 * `colors.overdue` for the error state), the same mechanism already used
 * for `Button`/`Switch`/`DateTimePicker`'s own `tint`/`accentColor`
 * theming.
 *
 * **`value`/`onChangeText` are plain controlled-component props, but
 * `@expo/ui`'s underlying field is driven by an `ObservableState` (a real
 * native `SharedObject`, not a plain JS value) — NOT a `{get, set}`
 * plain-object shape.** This component creates that observable once via
 * `useNativeState("")` and keeps it in sync with the external `value` prop
 * through a `useEffect` (writing `.value` imperatively whenever the prop
 * changes elsewhere, e.g. a form reset) — reads flow the other direction
 * through `onTextChange` (the plain JS callback `@expo/ui` also exposes,
 * not the observable's own worklet-only `onChange`, which requires
 * `react-native-worklets` and runs on the UI thread — not needed here
 * since this component has no synchronous-update requirement).
 *
 * **`useNativeState` constructs a real native-bridge `ExpoUI.ObservableState`
 * class that `jest-expo`'s own `expo-modules-core` mock has no built-in
 * stand-in for** (`ExpoUI.ObservableState is not a constructor` under
 * test, confirmed live) — this package's `jest.setup.ts` augments
 * `globalThis.expo.modules.ExpoUI` with a working mock class, following
 * the exact same precedent `jest-expo`'s OWN setup file already
 * establishes for `expo/fetch`'s `ExpoFetchModule.NativeRequest`/
 * `NativeResponse` stub classes. Any future `useNativeState`-based
 * component relies on that same setup file.
 *
 * **`Host` needs BOTH `matchContents={{ vertical: true }}` AND an explicit
 * `style={{ width: "100%" }}`** — the same two-part fix `DateTimePicker`'s
 * own doc comment documents: `matchContents` alone only ever bounds
 * height, never width, so a `Host` with no explicit width collapses to
 * intrinsic content size inside a shrink-to-content parent. Do not drop
 * either half of this pairing.
 */
/**
 * `variant="row"` — same additive treatment as `TextField`'s own `variant`
 * prop, added together with `Divider` for the borderless-row form
 * redesign: no `background`/`strokeBorder` modifiers at all, so the field
 * draws no chrome of its own and relies on its surrounding form card's
 * shared surface + `Divider` rows for the visual boundary. `variant=
 * "bordered"` (the default) is unchanged — this pilot's only existing call
 * site (Title, in `job-edit-form.tsx`) opts into `"row"`.
 *
 * **`floatingAbove`** — set by `FloatingLabelField` when it renders this
 * component in row mode: applies asymmetric top/bottom padding (more top,
 * to clear the floated label caption sitting above the value) instead of
 * `variant="row"`'s plain symmetric `padding({ vertical: 10 })`. Two real,
 * reported gaps this fixes: (1) with no top clearance at all, the value
 * text rendered visually cramped right up against the floated label above
 * it, since this component's own `padding` modifier had no way to know a
 * label was floating over it — `variant="row"` alone was never enough for
 * a `FloatingLabelField` consumer specifically. (2) this component had NO
 * `font` modifier at all, so it rendered SwiftUI's system-default text
 * size (visibly larger, ~17pt) instead of matching `SelectField`'s
 * explicit `text-[14px]` — confirmed on a real device as a value-text
 * size mismatch between `NativeTextField`/`TextField` rows and
 * `SelectField`/`SelectListField` rows in the same card. `font({ size:
 * FLOATING_LABEL_VALUE_FONT_SIZE })` now applies unconditionally
 * (independent of `floatingAbove`), matching `SelectField`'s value text
 * size everywhere, not only in `FloatingLabelField`'s own row.
 */
/**
 * **`floatingAbove`'s top padding took THREE measured iterations to
 * actually match `SelectField`'s label-to-value gap — read this before
 * changing the number again without re-measuring.** First attempt
 * (`top: 26`, picked by eye) measured on a real screenshot at a 48-49px
 * label-to-value gap in `NativeTextField` rows (Title/Job value) vs. only
 * 32-33px in `SelectField`/`SelectListField` rows (Status/Client) in the
 * SAME card — a visible ~16px inconsistency. A first correction (`top:
 * 21`, solving linearly for the pixel delta at the screenshot's 3x scale)
 * only closed part of the gap (measured 41-42px afterward) — the
 * pixel-to-padding relationship isn't a clean 3x ratio, likely because
 * SwiftUI's system-font line-height/leading adds its own space beyond the
 * raw `padding` value. **Final value, `top: 14`**, found by iterating
 * again from the observed ratio between the first two data points and
 * re-measuring — confirmed at 30-31px vs. Select's 32-33px, effectively
 * matching (≤3px residual, imperceptible). Any future change to this
 * value MUST be verified the same way: render a real screenshot, scan the
 * label/value text-row pixel bands (brightness thresholding along a
 * fixed x-range) for both a `NativeTextField` row and a `SelectField` row
 * in the same card, and compare the two gaps directly — do not pick a
 * number by eye, which is exactly what produced this bug twice already.
 *
 * **`multiline` + `floatingAbove` (Notes) needs its OWN padding and a real
 * minimum height — a real, reported gap: this component reused the
 * single-line `top: 14` tuning and had no minimum height at all for
 * `multiline`** (`Host matchContents={{ vertical: true }}` + `axis:
 * "vertical"` auto-grows purely to content, so an empty/short value
 * collapsed to roughly one line tall — nothing about it read as a
 * multi-line textarea). Fixed with `MULTILINE_MIN_HEIGHT` (a real `frame`
 * minimum, not a guess at padding alone) plus its own, slightly larger
 * top padding tuned for the label sitting above a textarea rather than a
 * single input line.
 */
export interface NativeTextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "decimal" | "email" | "numeric" | "phone";
  variant?: "bordered" | "row";
  floatingAbove?: boolean;
  /** Wires `@expo/ui`'s real `onFocusChange` — added for `FloatingLabelField`, which needs focus state to animate its label. */
  onFocus?: () => void;
  onBlur?: () => void;
  testID?: string;
}

/** Matches `SelectField`'s explicit `text-[14px]` value-text size — see this file's own doc comment on the font-size mismatch this fixes. */
const VALUE_FONT_SIZE = 14;
/** Matches Android's `TextField`-branch `h-24` (96pt) for the same `multiline` field — see `floating-label-field.tsx`'s own `h-24`. */
const MULTILINE_MIN_HEIGHT = 96;

const KEYBOARD_TYPE_TO_IOS: Record<
  NonNullable<NativeTextFieldProps["keyboardType"]>,
  "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad"
> = {
  default: "default",
  decimal: "decimal-pad",
  email: "email-address",
  numeric: "numeric",
  phone: "phone-pad",
};

export function NativeTextField({
  value,
  onChangeText,
  placeholder = "",
  error = false,
  disabled = false,
  multiline = false,
  keyboardType = "default",
  variant = "bordered",
  floatingAbove = false,
  onFocus,
  onBlur,
  testID,
}: NativeTextFieldProps) {
  const colors = useNativeColors();
  const borderColor = error ? colors.overdue : colors.borderStrong;
  const state = useNativeState(value);

  useEffect(() => {
    if (state.get() !== value) state.set(value);
  }, [state, value]);

  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <SwiftUITextField
        text={state}
        onTextChange={onChangeText}
        onFocusChange={(focused) => (focused ? onFocus?.() : onBlur?.())}
        placeholder={placeholder}
        axis={multiline ? "vertical" : "horizontal"}
        modifiers={[
          textFieldStyle("plain"),
          font({ size: VALUE_FONT_SIZE }),
          iosKeyboardType(KEYBOARD_TYPE_TO_IOS[keyboardType]),
          ...(variant === "row"
            ? [
                floatingAbove
                  ? multiline
                    ? padding({ top: 22, bottom: 6 })
                    : padding({ top: 14, bottom: 6 })
                  : padding({ vertical: 10 }),
                ...(multiline ? [frame({ minHeight: MULTILINE_MIN_HEIGHT, alignment: "top" as const })] : []),
              ]
            : [
                padding({ horizontal: 12, vertical: 10 }),
                background(colors.surface),
                strokeBorder({ color: borderColor, shape: "roundedRectangle", cornerRadius: 10 }),
              ]),
          iosDisabled(disabled),
        ]}
        testID={testID}
      />
    </Host>
  );
}
