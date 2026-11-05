import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import { MenuView } from "@expo/ui/community/menu";
import { useNativeColors } from "../theme/use-native-colors";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export interface SelectFieldOption<T extends string> {
  label: string;
  value: T;
}

export interface SelectFieldProps<T extends string> {
  options: SelectFieldOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: "bordered" | "row";
  /**
   * A floating-style label, matching `FloatingLabelField`'s text-field
   * treatment (see that component's doc comment for the full rationale):
   * when no option is selected, this text renders centered in the row as
   * the placeholder itself (`placeholder` is ignored in that state);
   * once a value is selected, it becomes a small caption above the
   * selected option's label. `SelectField` has no "focus" state to
   * animate through — tapping opens the menu immediately — so this is a
   * static two-state layout, not an animated transition.
   */
  floatingLabel?: string;
  required?: boolean;
  error?: boolean;
  className?: string;
  testID?: string;
}

/**
 * A `TextField`-styled select — same border/height/radius/colors as
 * `TextField`, opening a real native menu (`@expo/ui`'s community `MenuView`,
 * the same primitive `ContextMenu` wraps: SwiftUI `Menu` on iOS, Compose
 * `DropdownMenu` on Android) on tap, rather than the existing `Select`
 * component's own native dropdown-button chrome.
 *
 * **`variant="row"`** — same additive treatment as `TextField`'s own
 * `variant` prop (see its doc comment), added for the borderless-row form
 * redesign: drops the trigger's own border/background/radius entirely, for
 * use inside a grouped form card whose shared surface + `Divider` rows
 * provide the boundary instead. This was a real, reported gap in the first
 * pass of that redesign — the spec called for `SelectField` to "match the
 * row style once borderless," but only `TextField`/`NativeTextField`
 * actually got a `variant` prop; `SelectField` kept its bordered pill
 * unconditionally, which then visibly clashed against the now-borderless
 * Title/Client/Job value rows around it in the same card (confirmed via a
 * real device screenshot). `variant="bordered"` (the default) is
 * unchanged for every other existing consumer.
 *
 * Added because `Select` (`@expo/ui`'s universal `Picker`) has NO border/
 * background style props at all — confirmed against its real TS type, see
 * `select.tsx`'s own doc comment — so it renders as whatever bare button
 * chrome each platform's native `Picker` uses by default, visually
 * inconsistent with `TextField` and every other bordered field in a form
 * (a real, reported inconsistency: a Status `Select` next to a `TextField`
 * in the same form read as two different control families). `SelectField`
 * is NOT a replacement for `Select` — `Select` stays for call sites that
 * want the native picker's own default chrome (e.g. a plain settings row,
 * `templates/settings.tsx`); reach for `SelectField` specifically when a
 * select needs to visually match surrounding `TextField`s in a form.
 *
 * `MenuView`'s own trigger children are already wrapped in `RNHostView
 * matchContents` internally by `@expo/ui` itself (confirmed by reading
 * `@expo/ui/src/community/menu/MenuView.ios.tsx`/`.android.tsx`) — that's
 * the RN-subtree-reports-its-own-size-to-native direction, the same
 * mechanism `BottomSheet`'s own doc comment documents fixing for its
 * `children`, and already proven working via `ContextMenu`'s existing
 * trigger usage.
 *
 * `MenuComponentProps` has no whole-menu `disabled`/`enabled` prop at all
 * (confirmed against its real TS type — only a PER-ACTION
 * `attributes.disabled` exists) — so `disabled` here doesn't render a
 * `MenuView` at all when true, falling back to the same trigger markup as a
 * plain static `View` with no press handling, rather than rendering a
 * `MenuView` that LOOKS disabled (dimmed) but would still open on tap.
 *
 * **Android-only width bug — TWO failed fix attempts before this one, do
 * not repeat either.** `MenuView.android.tsx` wraps its trigger in `Host
 * matchContents` (both axes). `Host`'s own `RNHostView` content-sizing
 * bridge measures its child via a real Yoga-driven layout listener — so
 * this ISN'T "Host always ignores real width," which is what the first two
 * attempts assumed:
 *
 * 1. `style={{ width: "100%" }}` on `MenuView` itself — a percentage on
 *    `MenuView`'s own OUTER wrapper `View`. Failed because that `View`
 *    sits ABOVE `Host` in the tree, on the side `Host`'s own `onMeasure`
 *    (traced in `HostView.kt`) forces to `MeasureSpec.UNSPECIFIED`
 *    regardless of what its parent offers — a percentage can only resolve
 *    against a real constraint, and this side of the tree never has one.
 * 2. `style={{ width: measuredPx }}` (a concrete number from `onLayout`)
 *    on `MenuView` — same failure, for the same reason: still applied to
 *    `MenuView`'s OUTER wrapper, still on the wrong side of `Host`'s
 *    forced-unspecified measurement. A concrete number doesn't help if
 *    it's discarded at the exact same point a percentage was.
 *
 * **The actual fix: give the concrete measured pixel width to the TRIGGER
 * `View` itself — the child INSIDE `Host`, not `MenuView`'s wrapper
 * outside it.** `RNHostView` (per `@expo/ui`'s own `RNHostView.kt`,
 * confirmed already working for `ContextMenu`'s existing trigger usage)
 * measures ITS child via a real `View.OnLayoutChangeListener` and reports
 * that size into Compose — that's a genuine Yoga measurement of whatever
 * the trigger `View` itself resolves to, entirely independent of what
 * `Host`'s own outer `onMeasure` does. A `w-full`/`"100%"` trigger still
 * fails here (it has no real ancestor width to resolve against on this
 * side either, since `Host`'s content area itself starts unconstrained).
 * A concrete pixel width DOES resolve, because a fixed number needs no
 * ancestor constraint at all. That pixel number comes from `onLayout` on
 * an outer measuring `View` that lives OUTSIDE `MenuView`/`Host` entirely
 * (a plain sibling of the whole `MenuView` subtree, sized normally by
 * ordinary Yoga rules against its real real-world parent, `SelectField`'s
 * own caller) — then applied as an explicit `style={{ width }}` on the
 * trigger `View` itself (not `className="w-full"`, which is now dead
 * weight once a real pixel number is present, but left as the pre-layout
 * fallback for the one frame before `onLayout` first fires).
 */
export function SelectField<T extends string>({
  options,
  value,
  onValueChange,
  disabled = false,
  placeholder: placeholderProp,
  variant = "bordered",
  floatingLabel,
  required = false,
  error = false,
  className,
  testID,
}: SelectFieldProps<T>) {
  const t = useT();
  const placeholder = placeholderProp ?? t("uiNative.select.placeholder");
  const colors = useNativeColors();
  const selected = options.find((option) => option.value === value);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  const labelText = floatingLabel ? (required ? `${floatingLabel} *` : floatingLabel) : undefined;

  const trigger = (
    <View
      style={measuredWidth != null ? { width: measuredWidth } : undefined}
      className={cn(
        "w-full flex-row items-center justify-between px-0",
        variant === "row" ? "h-full" : "h-11 rounded-lg border bg-surface px-2.5 dark:bg-surface-dark border-border-strong dark:border-border-strong-dark",
        disabled ? "opacity-50" : "",
        className,
      )}
    >
      {labelText ? (
        <View className="flex-1 justify-center gap-1.5">
          {selected ? (
            <Text className={cn("text-[11px]", error ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark")}>
              {labelText}
            </Text>
          ) : null}
          <Text numberOfLines={1} className={cn("text-[14px]", selected ? "text-on-surface dark:text-on-surface-dark" : error ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark")}>
            {selected?.label ?? labelText}
          </Text>
        </View>
      ) : (
        <Text
          numberOfLines={1}
          className={cn(
            "flex-1 text-[14px]",
            selected ? "text-on-surface dark:text-on-surface-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark",
          )}
        >
          {selected?.label ?? placeholder}
        </Text>
      )}
      <ChevronDown size={16} color={colors.onSurfaceMuted} />
    </View>
  );

  if (disabled) {
    return (
      <View onLayout={handleLayout} className="w-full">
        {trigger}
      </View>
    );
  }

  return (
    <View onLayout={handleLayout} className="w-full">
      <MenuView
        actions={options.map((option) => ({ id: option.value, title: option.label, state: option.value === value ? "on" : "off" }))}
        onPressAction={(event) => onValueChange(event.nativeEvent.event as T)}
        shouldOpenOnLongPress={false}
        testID={testID}
      >
        {trigger}
      </MenuView>
    </View>
  );
}
