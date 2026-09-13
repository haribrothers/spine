import { useMemo, useRef, useState, type Context } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CheckIcon from "lucide-react-native/icons/check";
import { useNativeColors } from "../theme/use-native-colors";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "../lib/cn";

/**
 * RN exposes `ScrollView.Context` (a real React context whose value tells
 * `VirtualizedList` whether it has an enclosing `ScrollView`, and in which
 * orientation) at runtime — confirmed by reading `ScrollView.js` itself
 * (`static Context: typeof ScrollViewContext = ScrollViewContext`) — but
 * `@types/react-native`'s public `.d.ts` for `ScrollView` doesn't declare
 * that static property, so TypeScript doesn't know it exists. This narrow
 * cast exposes just that one property with its real shape (a `Context` of
 * `"HORIZONTAL" | "VERTICAL" | null`, per RN's own `ScrollViewContext.js`)
 * rather than casting the whole render to `any`.
 */
const ScrollViewContext = (ScrollView as unknown as { Context: Context<"HORIZONTAL" | "VERTICAL" | null> }).Context;

/**
 * Fixed per-row height — a real, reported regression fix. `BottomSheet`'s
 * `matchContents`/`snapPoints` fix (see that file's own doc comment)
 * changed this list from an intrinsic-sized layout to a real fixed-height
 * fill, and this row's OWN `py-3` padding (12px, unchanged) suddenly read
 * as visibly cramped once every row was laid out against that real,
 * constrained height rather than the previous (accidentally oversized)
 * intrinsic one.
 *
 * **A real `height` (not `minHeight`), plus `numberOfLines={1}` on the
 * label, on the row itself — not just vertical padding — a SECOND real bug,
 * found right after the first fix shipped: the list stopped scrolling
 * entirely.** `getItemLayout` below promises `FlatList` a fixed per-row
 * length up front (required for `initialScrollIndex` to jump to a
 * not-yet-rendered row without measuring it live first) — but a row with
 * `minHeight` (not a real fixed `height`) can grow taller than that promise
 * if its label wraps to a second line, and once ANY row's real height
 * disagrees with `getItemLayout`'s claimed offsets, `VirtualizedList`'s
 * internal scroll-position math goes wrong, which manifested as the whole
 * list appearing frozen/non-scrollable rather than just a minor visual
 * misalignment. A real fixed `height` plus `numberOfLines={1}` (truncating
 * a long label instead of letting it wrap and grow) makes `getItemLayout`'s
 * promise always true.
 */
const OPTION_ROW_HEIGHT = 52;

// Must match the `fraction` passed to `BottomSheet`'s own `snapPoints` prop
// below — kept as one named constant so the two can't drift apart.
const SHEET_HEIGHT_FRACTION = 0.75;

// A rough estimate of the sheet's own chrome (drag indicator + top inset)
// plus this content's own title/search-box/padding, subtracted from the
// snap-point height to get the FlatList's real available height. Doesn't
// need to be pixel-exact — it only has to be close enough that the list
// visibly fits within the sheet without the last row being clipped by the
// sheet's own bottom edge; a few pixels of slack either way isn't
// noticeable in a scrollable list.
const SHEET_CHROME_HEIGHT = 140;

export interface SelectListFieldOption<T extends string> {
  label: string;
  value: T;
}

export interface SelectListFieldProps<T extends string> {
  options: SelectListFieldOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  variant?: "bordered" | "row";
  /**
   * A floating-style label — see `SelectField`'s own `floatingLabel` doc
   * comment for the full behavior (empty: centered placeholder text; has a
   * value: small caption above the selected option's label). Same static,
   * non-animated two-state layout, for the same reason (tapping opens the
   * sheet immediately rather than an inline edit mode).
   */
  floatingLabel?: string;
  required?: boolean;
  sheetTitle?: string;
  testID?: string;
}

/**
 * The "large list" counterpart to `SelectField` — for a select whose option
 * count makes a native dropdown/context menu (`SelectField`'s `MenuView`)
 * unusable (e.g. Client, picked from a contacts list that can run into the
 * hundreds), this opens a full `BottomSheet` with a search box pinned above
 * a scrollable, filterable list instead. `SelectField` stays the right
 * choice for short, fixed enums (Job Status and similar, typically under
 * ~8 options) — reach for `SelectListField` only when the option set is
 * genuinely long and benefits from filtering, not as a blanket replacement.
 *
 * Selection-only: there is no inline "create new" affordance here — picking
 * always chooses from the existing `options` list. If a future screen needs
 * create-on-the-fly (e.g. adding a brand-new client from the job form),
 * that's a separate, explicitly-scoped addition, not implied by this
 * component.
 *
 * Closed-state trigger matches `TextField`/`SelectField`'s row treatment —
 * `variant="row"` (the default here, since every current consumer is a
 * borderless form row) drops its own border/background, `variant=
 * "bordered"` keeps a standalone bordered-box look for a call site outside
 * a grouped form card.
 */
export function SelectListField<T extends string>({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  error = false,
  variant = "row",
  floatingLabel,
  required = false,
  sheetTitle,
  testID,
}: SelectListFieldProps<T>) {
  const colors = useNativeColors();
  const { height: windowHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<FlatList<SelectListFieldOption<T>>>(null);
  // A real, computed pixel height for the FlatList — NOT `flex: 1` inside
  // the sheet's content `View`. `flex: 1` was tried first here and the list
  // stopped scrolling entirely: `BottomSheet`'s content sits inside
  // `RNHostView`'s non-`matchContents` fill branch (a SwiftUI `.frame(
  // maxWidth: .infinity, maxHeight: .infinity)`, see that file's own doc
  // comment), and the actual RN-side height for that subtree arrives via a
  // report-back through `ReportSizeToYogaNodeModifier`, not a normal Yoga
  // layout pass a plain `flex: 1` child can resolve against reliably —
  // the same class of "no available dimension for a relative size to
  // resolve against" issue documented at length in `full-width-button.tsx`
  // and `bottom-sheet.tsx`'s own history. A real, pre-computed number
  // sidesteps that resolution question entirely.
  const listHeight = Math.max(windowHeight * SHEET_HEIGHT_FRACTION - SHEET_CHROME_HEIGHT, OPTION_ROW_HEIGHT * 3);
  // Set only at the moment the sheet opens (in `handleOpen`, before `query`
  // resets to "" and `filtered` becomes the full `options` list again) — a
  // real, reported bug: reopening the sheet after picking e.g. the 50th of
  // 120 options showed the list scrolled back to the top, with no
  // indication where the current selection was without scrolling down
  // again. `FlatList`'s `initialScrollIndex` only applies on mount, not on
  // every render, so this is read once per open via a ref rather than a
  // plain derived value recomputed on every keystroke while typing.
  const initialScrollIndexRef = useRef<number | undefined>(undefined);
  // Bumped on every open — `FlatList` is keyed on this below so it fully
  // REMOUNTS each time the sheet opens, since `initialScrollIndex` only
  // ever applies at mount, not on every prop change (`BottomSheet` keeps
  // its content mounted across `isPresented` toggles, so without this the
  // list would only ever honor `initialScrollIndex` on the very first
  // open).
  const [openSessionId, setOpenSessionId] = useState(0);

  const selected = options.find((option) => option.value === value);
  const labelText = floatingLabel ? (required ? `${floatingLabel} *` : floatingLabel) : undefined;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) => option.label.toLowerCase().includes(trimmed));
  }, [options, query]);

  function handleOpen() {
    if (disabled) return;
    setQuery("");
    const selectedIndex = value ? options.findIndex((option) => option.value === value) : -1;
    initialScrollIndexRef.current = selectedIndex >= 0 ? selectedIndex : undefined;
    setOpenSessionId((n) => n + 1);
    setIsOpen(true);
  }

  function handleSelect(option: SelectListFieldOption<T>) {
    onValueChange(option.value);
    setIsOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        testID={testID}
        className={cn(
          "w-full flex-row items-center justify-between",
          variant === "row"
            ? "h-full"
            : ["h-11 rounded-lg border bg-surface px-2.5 dark:bg-surface-dark", error ? "border-overdue dark:border-overdue-dark" : "border-border-strong dark:border-border-strong-dark"].join(" "),
          disabled ? "opacity-50" : "",
        )}
      >
        {labelText ? (
          <View className="flex-1 justify-center gap-1.5">
            {selected ? (
              <Text className={cn("text-[11px]", error ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark")}>
                {labelText}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              className={cn(
                "text-[14px]",
                selected ? "text-on-surface dark:text-on-surface-dark" : error ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark",
              )}
            >
              {selected?.label ?? labelText}
            </Text>
          </View>
        ) : (
          <Text
            numberOfLines={1}
            className={cn(
              "flex-1 text-[14px]",
              selected
                ? error
                  ? "text-overdue dark:text-overdue-dark"
                  : "text-on-surface dark:text-on-surface-dark"
                : "text-on-surface-muted dark:text-on-surface-muted-dark",
            )}
          >
            {selected?.label ?? placeholder}
          </Text>
        )}
        <ChevronRight size={16} color={colors.onSurfaceMuted} />
      </Pressable>

      <BottomSheet isPresented={isOpen} onDismiss={() => setIsOpen(false)} snapPoints={[{ fraction: SHEET_HEIGHT_FRACTION }]}>
        <View className="gap-3 px-4 pb-4 pt-2">
          {sheetTitle ? (
            <Text className="text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">{sheetTitle}</Text>
          ) : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.onSurfaceMuted}
            autoFocus
            className="h-11 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-[14px] text-on-surface dark:border-border-strong-dark dark:bg-surface-dark dark:text-on-surface-dark"
          />
          {/*
            The sheet's content lives in the React tree as a descendant of
            whatever screen renders this field — e.g. `job-edit-form.tsx`'s
            outer form `ScrollView` — even though `BottomSheet` PRESENTS it
            via a detached native modal (SwiftUI `.sheet()`/Compose
            `ModalBottomSheet`, see `bottom-sheet.tsx`'s own doc comment).
            RN's nested-VirtualizedList warning walks React context, not the
            native view hierarchy, so this `FlatList` still trips it against
            that ancestor `ScrollView` — a real, reported console error,
            confirmed live on a real device. `ScrollViewContext.Provider
            value={null}` (the local alias for `ScrollView.Context` this
            file exposes above, since `@types/react-native` doesn't declare
            it) resets that context for everything under it, telling RN's
            own detection there is no enclosing ScrollView from here down,
            which is accurate: nothing between this point and the native
            sheet boundary actually scrolls together with the form.
          */}
          <ScrollViewContext.Provider value={null}>
            <FlatList
              key={openSessionId}
              style={{ height: listHeight }}
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View className="h-px w-full bg-border dark:bg-border-dark" />}
              ListEmptyComponent={
                <Text className="py-6 text-center text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
                  No matches.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    testID={testID ? `${testID}-option-${item.value}` : undefined}
                    className="flex-row items-center justify-between px-1"
                    style={{ height: OPTION_ROW_HEIGHT }}
                  >
                    <Text numberOfLines={1} className="flex-1 text-[14px] text-on-surface dark:text-on-surface-dark">
                      {item.label}
                    </Text>
                    {isSelected ? <CheckIcon size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
              getItemLayout={(_, index) => ({ length: OPTION_ROW_HEIGHT + 1, offset: (OPTION_ROW_HEIGHT + 1) * index, index })}
              initialScrollIndex={initialScrollIndexRef.current}
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                // A real, documented FlatList footgun, not a bug in this
                // component: `scrollToIndex`/`initialScrollIndex` can fail
                // if the target index hasn't been measured yet (e.g. a very
                // long list not yet laid out this far) — RN's own docs
                // recommend retrying via `scrollToOffset` using the
                // reported `averageItemLength` as a fallback estimate.
                listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
              }}
              ref={listRef}
            />
          </ScrollViewContext.Provider>
        </View>
      </BottomSheet>
    </>
  );
}
