import { Text, View } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import { MenuView } from "@expo/ui/community/menu";
import { useNativeColors } from "../theme/use-native-colors";
import { cn } from "../lib/cn";

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
 * trigger usage. This is a DIFFERENT direction/mechanism than the one that
 * broke `DateTimePicker`'s Android inline grid (a native Compose child
 * reporting ITS OWN intrinsic size back to Yoga via `matchContentsVertical`
 * on `HostView.kt`) — this component's trigger is a plain RN `View`, not a
 * native-bridge child, so that bug class doesn't apply here.
 *
 * `MenuComponentProps` has no whole-menu `disabled`/`enabled` prop at all
 * (confirmed against its real TS type — only a PER-ACTION
 * `attributes.disabled` exists) — so `disabled` here doesn't render a
 * `MenuView` at all when true, falling back to the same trigger markup as a
 * plain static `View` with no press handling, rather than rendering a
 * `MenuView` that LOOKS disabled (dimmed) but would still open on tap.
 */
export function SelectField<T extends string>({
  options,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select…",
  className,
  testID,
}: SelectFieldProps<T>) {
  const colors = useNativeColors();
  const selected = options.find((option) => option.value === value);

  const trigger = (
    <View
      className={cn(
        "h-11 w-full flex-row items-center justify-between rounded-lg border bg-surface px-2.5 dark:bg-surface-dark",
        "border-border-strong dark:border-border-strong-dark",
        disabled ? "opacity-50" : "",
        className,
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          "flex-1 text-[14px]",
          selected ? "text-on-surface dark:text-on-surface-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark",
        )}
      >
        {selected?.label ?? placeholder}
      </Text>
      <ChevronDown size={16} color={colors.onSurfaceMuted} />
    </View>
  );

  if (disabled) {
    return trigger;
  }

  return (
    <MenuView
      actions={options.map((option) => ({ id: option.value, title: option.label, state: option.value === value ? "on" : "off" }))}
      onPressAction={(event) => onValueChange(event.nativeEvent.event as T)}
      shouldOpenOnLongPress={false}
      testID={testID}
    >
      {trigger}
    </MenuView>
  );
}
