import { Platform } from "react-native";
import ExpoDateTimePicker, { type DateTimePickerProps as ExpoDateTimePickerProps } from "@expo/ui/community/datetime-picker";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s community `DateTimePicker` — `@react-native-community/
 * datetimepicker`-compatible, real native pickers on both platforms
 * (SwiftUI `DatePicker` on iOS, Android's Material date/time dialogs).
 * Net-new component.
 *
 * Prop shape is simplified from `@expo/ui`'s own (which mirrors the older
 * community library closely, including a deprecated `onChange` and a
 * `DateTimePickerEvent` wrapper) down to the plain `value`/`onChange` pair
 * matching web `packages/ui`'s DatePicker — this wrapper maps that onto
 * `@expo/ui`'s `onValueChange`, discarding the event wrapper's
 * timestamp/utcOffset fields callers don't need for a controlled `Date`.
 *
 * `accentColor` defaults to the design system's `primary` token (via
 * `useNativeColors()`) rather than requiring every call site to pass it —
 * this is a plain color prop on `@expo/ui`'s own component (unlike Button/
 * Switch/Slider/Picker, which take no color prop at all and rely entirely
 * on `Host`'s `seedColor`), so it's resolved the same way `select.tsx`
 * resolved raw colors for `@react-native-picker/picker` before this
 * rework: a direct prop, not a `Host` wrapper.
 *
 * **`presentation="inline"` is forced, overriding `@expo/ui`'s own
 * `"dialog"` default on Android** — a real, reported, reproduced bug on a
 * real device otherwise: `@expo/ui`'s own `DateTimePickerProps.presentation`
 * doc comment says outright that `'dialog'` "shows a modal dialog that
 * opens on mount... The caller should unmount the component in response,"
 * i.e. it is not a self-contained control with its own open/closed state —
 * rendering `<ExpoDateTimePicker>` at all IS "show the dialog," and there is
 * no prop to close it again short of unmounting the whole component. This
 * wrapper never did that (it's meant to be an always-visible inline
 * control, matching every other `packages/ui-native` field-style
 * component), so on Android the dialog appeared but neither its Cancel nor
 * OK button could ever actually dismiss it — both fire a callback, but the
 * component stays mounted and the dialog stays open. iOS was never affected
 * because `presentation` "is accepted but ignored" there (SwiftUI's
 * `DatePicker` is always inline, per the same doc comment) — which is
 * exactly why this shipped unnoticed until real Android device testing.
 * `presentation="inline"` uses Android's Compose inline `DateTimePicker`
 * variant instead of the dialog one, matching iOS's always-inline behavior
 * — consistent cross-platform UX, and the dialog lifecycle problem doesn't
 * apply to an inline control at all.
 *
 * **KNOWN OPEN BUG, not yet fixed — Android's inline variant renders with a
 * giant, near-fullscreen empty box when nested inside a `ScrollView`,**
 * found on a real Android emulator while fixing the dialog-lifecycle bug
 * above. `@expo/ui`'s own Android implementation wraps the inline Compose
 * picker in `Host matchContents={{vertical: true}}` (`@expo/ui/src/
 * community/datetime-picker/DateTimePicker.android.tsx`, intended to size
 * the Host to the picker's own intrinsic content height) — but this
 * collapses to an unbounded/near-fullscreen height instead of the
 * ~300-350dp a Material3 calendar grid actually needs, when the Host sits
 * inside an RN `ScrollView`'s unbounded vertical layout (plausibly a
 * Compose-inside-RN-ScrollView measurement ambiguity: the `ScrollView`
 * offers unbounded height, so "match my content" has no finite constraint
 * to resolve against). Confirmed the picker is still FUNCTIONALLY correct
 * despite the layout bug — tapping inside the oversized box and checking
 * the demo screen's own `date.toDateString()` output confirmed a real date
 * selection round-trips correctly — this is a pure layout/legibility bug,
 * not a functional blocker. iOS is unaffected (`presentation` is ignored
 * there; SwiftUI's own inline `DatePicker` sizes correctly).
 *
 * An explicit Android-only `height` passed through the `style` prop
 * `@expo/ui`'s component already accepts was tried as the fix and DID NOT
 * work — confirmed via a full app reload (not just Fast Refresh) that the
 * box stayed exactly the same oversized height regardless, meaning
 * `Host`'s own `matchContents` sizing wins over an explicit `style.height`
 * here rather than the reverse. Left in place below since it's harmless and
 * may start working with a future `@expo/ui` release, but it is NOT a
 * confirmed fix — do not remove the "known open bug" framing above until a
 * real device screenshot confirms the calendar grid renders at a normal,
 * bounded height. Next things worth trying if this is picked up again:
 * wrapping the picker in a fixed-height outer `View` instead of a
 * `ScrollView`-nested one, or filing/checking for an upstream `@expo/ui`
 * issue about `matchContents` inside `ScrollView`.
 */
const ANDROID_INLINE_DATE_PICKER_HEIGHT = 340;

export interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: ExpoDateTimePickerProps["mode"];
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  testID?: string;
}

export function DateTimePicker({ value, onChange, mode = "date", minimumDate, maximumDate, disabled = false, testID }: DateTimePickerProps) {
  const colors = useNativeColors();
  const needsExplicitHeight = Platform.OS === "android" && mode !== "time";

  return (
    <ExpoDateTimePicker
      value={value}
      onValueChange={(_event, date) => onChange(date)}
      mode={mode}
      presentation="inline"
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      disabled={disabled}
      accentColor={colors.primary}
      style={needsExplicitHeight ? { height: ANDROID_INLINE_DATE_PICKER_HEIGHT } : undefined}
      testID={testID}
    />
  );
}
