import { Platform, Pressable, Text, View } from "react-native";
import { useState } from "react";
import CalendarIcon from "lucide-react-native/icons/calendar";
import ClockIcon from "lucide-react-native/icons/clock";
import ExpoDateTimePicker, { type DateTimePickerProps as ExpoDateTimePickerProps } from "@expo/ui/community/datetime-picker";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { disabled as disabledMod } from "@expo/ui/swift-ui/modifiers";
import { useT, formatLocale } from "../lib/i18n";
import { useNativeColors } from "../theme/use-native-colors";
import { OutlinedFrame } from "./outlined-text-field";

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
 * **FIFTH design — reverted the fourth design's iOS branch after a real,
 * reported "not working properly on iOS" regression, and changed the
 * intended LAYOUT for both platforms from a full-width block field to a
 * compact, inline, `Switch`-style row control (label left, control right).
 * Read this before touching platform branches again — there is real
 * history here, not just taste.**
 *
 * - **iOS**: back to rendering `<ExpoDateTimePicker>` directly (no
 *   `BottomSheet`, no custom trigger) — but now with `display="compact"`
 *   instead of the original always-visible `presentation="inline"`
 *   graphical calendar. SwiftUI's `.compact` style IS a small, real native
 *   pill that pops its OWN built-in calendar/wheel overlay on tap — this is
 *   the fully-native inline-row control being asked for, not a
 *   reimplementation of one. The fourth design's `BottomSheet` wrapper is
 *   REMOVED entirely: it was a custom-built substitute for tap-to-open
 *   presentation that this SwiftUI style already provides natively, and it
 *   was the fourth design's own regression (reported as "date picker not
 *   working properly on iOS") — do not reintroduce it for this control.
 * - **Android**: unchanged mechanism from the third/fourth design — tapping
 *   a small trigger mounts `<ExpoDateTimePicker presentation="dialog">`,
 *   Android's own native Material dialog, mounted only while `open` is
 *   true and unmounted via `onDismiss` (fires for both Cancel and a
 *   confirmed OK). Only the trigger's WIDTH changed: no longer `w-full` (a
 *   block-level field), now sized to its own content so it fits inline in
 *   a row next to a label, matching iOS's compact pill and `Switch`'s own
 *   row shape.
 *
 * **Do not go back to the fourth design's shared `TextField`-styled
 * trigger + calendar/clock icon + `BottomSheet`-on-iOS shape.** That design
 * was a deliberate visual-consistency fix (matching Android's trigger
 * chrome to `TextField`) but broke iOS in practice — a `BottomSheet`
 * hosting `presentation="inline"`'s full graphical calendar is a real,
 * different code path from this component's original, long-working inline
 * calendar, and evidently was not equivalent. `display="compact"` sidesteps
 * this entirely by using a real native SwiftUI mechanism instead of a
 * custom-built one.
 *
 * **History — earlier Android-only designs, still do not re-attempt:**
 * 1. `presentation="inline"` unconditionally on both platforms — Android's
 *    own dialog-mode default has no way to close short of unmounting, and
 *    this wrapper never did, so the dialog appeared and could never close.
 * 2. `presentation="inline"` + forced `display="spinner"` on Android to
 *    dodge a real bug where the inline Compose `DatePicker` grid never
 *    lays out inside `@expo/ui`'s own `Host matchContents={{vertical:
 *    true}}` (traced into `@expo/ui`'s native `HostView.kt`:
 *    `matchContentsVertical` forces `MeasureSpec.UNSPECIFIED`
 *    UNCONDITIONALLY, ignoring any `style.height`) — this "fixed" the
 *    layout by rendering a text-entry field instead of a calendar, which
 *    changed the interaction model, not just the styling.
 * Android's current dialog-trigger mechanism (mount-only-while-open,
 * `presentation="dialog"`, `onDismiss` unmounts) fixes #1 properly and
 * sidesteps #2 by never laying the grid out inside this component's own
 * `Host` at all — a `presentation="dialog"` picker renders in its own
 * dialog window. This mechanism is unchanged in this fifth design.
 *
 * **Fifth-design FOLLOW-UP FIX, iOS**: the initial fifth-design iOS branch
 * passed no `style` at all to `<ExpoDateTimePicker>`. `Host`'s
 * `matchContents={{ vertical: true }}` (`@expo/ui`'s own iOS
 * `DateTimePicker.tsx`) only constrains HEIGHT, never width — with no
 * explicit width, the compact pill's `Host` had no bounded width to lay
 * out against inside a `flex-row justify-between` row, and was reported
 * overflowing past its card's right edge (clipped) with taps landing
 * nowhere useful. Fixed with an explicit `style={{ width, height }}` (140pt
 * for date/datetime, 90pt for time — SwiftUI's compact pill is genuinely
 * that small, this isn't a guess at some larger field size). Also
 * restored the calendar/clock icon on Android's trigger (present in the
 * fourth design, dropped when the fifth design shrank the trigger to
 * content width) — the icon and the width change are independent; the
 * icon was never the problem, only forgotten during the row-layout pass.
 *
 * **Right-alignment offset (iOS only) — a real, reported visual
 * inconsistency, not a layout bug in a form's own row usage.** SwiftUI's
 * `.compact` `DatePicker` style bakes its own internal trailing padding
 * into the native pill's rendered bounds (confirmed by comparing it
 * against `Switch`'s own `Host matchContents` pill, which hugs its real
 * toggle geometry tightly with no equivalent trailing gap) — so at the
 * SAME `width: 140/90` this component already uses (kept unchanged, since
 * that width prevents the earlier-documented overflow-clipping regression;
 * shrinking it is not the fix), the pill's visible content sits noticeably
 * short of the box's true right edge, reading as extra right-side padding
 * compared to a `Switch` in the same row shape (confirmed on a real
 * device). Fixed with a small, measured `marginRight: -8` on an OUTER
 * wrapper `View` (not on `ExpoDateTimePicker`'s own `style`, which is the
 * width/height the native pill measures itself against and must stay
 * untouched) — pulling the whole pill visually flush with `Switch`'s
 * right edge without touching the pill's own internal layout at all.
 *
 * **SIXTH design, iOS only — switched from the community `ExpoDateTimePicker`
 * wrapper to `@expo/ui/swift-ui`'s own `DatePicker` + `Host` directly.**
 * Two real, confirmed reasons, not a preference:
 * 1. Theming: the community wrapper's `accentColor` prop produced a
 *    per-component `tint` modifier; `swift-ui`'s `Host.seedColor` instead
 *    applies `.tint(seedColor)` to the whole SwiftUI subtree (traced into
 *    `@expo/ui`'s own `HostView.swift`: `SeedColorModifier` does exactly
 *    this) — a real, equivalent mechanism, just applied at the `Host`
 *    level instead of per-component, and confirmed on a real iOS
 *    simulator to render the same primary-color tint as before.
 * 2. **`mode="datetime"` was a real, silent gap in the intermediate
 *    version of this file — confirmed by a passing typecheck and test
 *    suite that never exercised it, since no call site used that mode at
 *    the time.** An in-between version of this component's iOS branch had
 *    `displayedComponents={mode === "time" ? ["hourAndMinute"] : ["date"]}`
 *    — only two branches, so `"datetime"` fell into the `else` and
 *    silently showed date-only, dropping the time component entirely with
 *    no error, warning, or visual indication anything was wrong. Fixed by
 *    giving `displayedComponents` all three real branches — `"datetime"`
 *    now passes `["date", "hourAndMinute"]` (a real, valid array per
 *    `DatePickerComponent[]`'s own type — SwiftUI's `DatePicker` supports
 *    showing both components in one control), so a `datetime`-mode picker
 *    on iOS looks and behaves like a genuine single combined
 *    date-and-time picker on one line, not two separate controls.
 *
 * **Android's `mode="datetime"` needed a different fix — there is no
 * native combined date+time dialog to reach for.** `@expo/ui`'s own
 * community `DateTimePicker.android.tsx` documents this directly
 * (`modeToDisplayedComponents`: "Android has no inline datetime picker —
 * fall back to date only") — passing `mode="datetime"` straight through to
 * `ExpoDateTimePicker presentation="dialog"` on Android silently loses the
 * time component the exact same way the iOS gap did, and this wrapper
 * previously did exactly that (forwarding `mode` verbatim). Fixed by
 * handling `datetime` explicitly in `AndroidDateTimePickerField`: tapping
 * the trigger opens the DATE dialog first; on confirm, it immediately
 * opens the TIME dialog (pre-filled with the previous time-of-day, not
 * midnight); on that second confirm, the two are merged into one `Date`
 * (the newly-picked date's y/m/d combined with the newly-picked time's
 * h/m) before calling `onChange` once. Cancelling either step cancels the
 * whole flow without calling `onChange` at all — matching the existing
 * single-dialog `onDismiss` behavior for `date`/`time` mode, just spanning
 * two dialogs instead of one. This is a real, deliberate two-step native
 * flow (the standard Android pattern for datetime entry, e.g. how the
 * Android Calendar app collects an event's start time), not a workaround
 * to avoid — Android genuinely has no single native widget for this.
 */

export interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: ExpoDateTimePickerProps["mode"];
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  testID?: string;
  /**
   * Android only: `outlined` is Material 3's outlined field (`OutlinedFrame`)
   * with `label` on its outline and the calendar/clock icon at the end — for
   * forms built from outlined fields. iOS always shows SwiftUI's compact pill.
   */
  variant?: "pill" | "outlined";
  label?: string;
}

function formatValue(value: Date, mode: ExpoDateTimePickerProps["mode"]) {
  if (mode === "time") {
    return value.toLocaleTimeString(formatLocale(), { hour: "numeric", minute: "2-digit" });
  }
  if (mode === "datetime") {
    return value.toLocaleString(formatLocale());
  }
  return value.toLocaleDateString(formatLocale());
}

/** The outlined field's value as `MobExpenseNewAndroid` draws it: "8 Oct 2026" (a date spelled out, in the phone's locale order). */
function outlinedValue(value: Date, mode: ExpoDateTimePickerProps["mode"]) {
  if (mode !== "date") return formatValue(value, mode);
  return value.toLocaleDateString(formatLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/**
 * All three real branches — see this file's own doc comment (SIXTH
 * design) for why `"datetime"` falling through to a two-branch `? :`
 * silently dropped the time component, undetected, until a real
 * `mode="datetime"` call site was added.
 */
function displayedComponentsForMode(mode: ExpoDateTimePickerProps["mode"]): ("date" | "hourAndMinute")[] {
  switch (mode) {
    case "time":
      return ["hourAndMinute"];
    case "datetime":
      return ["date", "hourAndMinute"];
    case "date":
    default:
      return ["date"];
  }
}

/** Merges a newly-picked date's year/month/day with a newly-picked time's hour/minute — see this file's own doc comment (Android's two-step `datetime` flow) for why this exists. */
function mergeDateAndTime(date: Date, time: Date): Date {
  const merged = new Date(date);
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return merged;
}

export function DateTimePicker({ value, onChange, mode = "date", minimumDate, maximumDate, disabled = false, testID, variant = "pill", label }: DateTimePickerProps) {
  const colors = useNativeColors();

  if (Platform.OS === "android") {
    return (
      <View>
        <AndroidDateTimePickerField
          value={value}
          onChange={onChange}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          disabled={disabled}
          testID={testID}
          outlinedLabel={variant === "outlined" ? (label ?? "") : undefined}
          accentColor={colors.primary}
          iconColor={colors.onSurfaceMuted}
        />
      </View>
    );
  }

  return (
    <Host
      style={{ flex: 1, minWidth: mode === "datetime" ? 240 : 140, height: 32 }}
      seedColor={colors.primary}
      matchContents={{ vertical: true }}
    >
      <DatePicker
        selection={value}
        title=""
        onDateChange={(date: Date) => onChange(date)}
        displayedComponents={displayedComponentsForMode(mode)}
        range={{ start: minimumDate, end: maximumDate }}
        modifiers={disabled ? [disabledMod()] : undefined}
        testID={testID}
      />
    </Host>
  );
}

function AndroidDateTimePickerField({
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  disabled,
  testID,
  outlinedLabel,
  accentColor,
  iconColor,
}: Required<Pick<DateTimePickerProps, "value" | "onChange" | "mode" | "disabled">> &
  Pick<DateTimePickerProps, "minimumDate" | "maximumDate" | "testID"> & { outlinedLabel?: string; accentColor: string; iconColor: string }) {
  const t = useT();
  // `false` = closed. For `date`/`time` mode, `"date"`/`"time"` is the one
  // dialog step. For `datetime` mode (no native combined dialog on Android
  // — see this file's own doc comment), this is a real two-step state
  // machine: `"date"` first, then `"time"` (carrying the just-picked date
  // forward in `pendingDate`, not the original `value`, so the date the
  // user just chose is what the time gets merged onto).
  const [step, setStep] = useState<"date" | "time" | false>(false);
  const [pendingDate, setPendingDate] = useState(value);

  function handlePress() {
    setPendingDate(value);
    setStep(mode === "time" ? "time" : "date");
  }

  function handleDateConfirmed(date: Date) {
    if (mode === "datetime") {
      // First step done — carry the picked date forward and open the time
      // dialog next, rather than calling `onChange` yet.
      setPendingDate(date);
      setStep("time");
      return;
    }
    onChange(date);
    setStep(false);
  }

  function handleTimeConfirmed(time: Date) {
    onChange(mode === "datetime" ? mergeDateAndTime(pendingDate, time) : time);
    setStep(false);
  }

  const outlined = outlinedLabel !== undefined;
  const Icon = mode === "time" ? ClockIcon : CalendarIcon;
  return (
    <>
      {outlined ? (
        <Pressable disabled={disabled} onPress={handlePress} accessibilityRole="button" accessibilityLabel={t("uiNative.select.triggerLabel", { label: outlinedLabel, value: outlinedValue(value, mode) })} accessibilityState={{ disabled }} testID={testID} className={disabled ? "opacity-50" : ""}>
          <OutlinedFrame label={outlinedLabel}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark">{outlinedValue(value, mode)}</Text>
              <Icon size={20} color={iconColor} />
            </View>
          </OutlinedFrame>
        </Pressable>
      ) : (
      <Pressable
        disabled={disabled}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        testID={testID}
        style={{ height: 36 }}
        className={[
          "h-9 flex-row items-center justify-center gap-1.5 self-start rounded-lg border bg-surface px-3 dark:bg-surface-dark",
          "border-border-strong dark:border-border-strong-dark",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">{formatValue(value, mode)}</Text>
        <Icon size={16} color={iconColor} />
      </Pressable>
      )}
      {step === "date" ? (
        <ExpoDateTimePicker
          value={value}
          onValueChange={(_event, date) => handleDateConfirmed(date)}
          onDismiss={() => setStep(false)}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={accentColor}
        />
      ) : null}
      {step === "time" ? (
        <ExpoDateTimePicker
          value={mode === "datetime" ? pendingDate : value}
          onValueChange={(_event, date) => handleTimeConfirmed(date)}
          onDismiss={() => setStep(false)}
          mode="time"
          presentation="dialog"
          accentColor={accentColor}
        />
      ) : null}
    </>
  );
}
