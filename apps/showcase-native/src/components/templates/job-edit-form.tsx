import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useNavigation, useRouter, type NativeStackHeaderItem } from "expo-router";
import { useColorScheme } from "nativewind";
import {
  Button,
  DateTimePicker,
  Divider,
  FloatingLabelField,
  SelectField,
  SelectListField,
  Spinner,
  Switch,
  Toast,
  useNativeColors,
  useToast,
} from "@spine/ui-native";

const JOB_STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "On hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
] as const;

type JobStatus = (typeof JOB_STATUS_OPTIONS)[number]["value"];

/** Stand-in "the org's contacts" for the template — a real screen would fetch this list. */
const CLIENT_OPTIONS = [
  { label: "Acme Contracting Ltd.", value: "acme" },
  { label: "Bright Homes", value: "bright" },
  { label: "Coastal Renovations", value: "coastal" },
  { label: "Dunmore & Sons", value: "dunmore" },
  { label: "Elmfield Developments", value: "elmfield" },
  { label: "Foster Build Group", value: "foster" },
  { label: "Granite Peak Construction", value: "granite" },
  { label: "Harborview Fit-Out", value: "harborview" },
  { label: "Ironclad Contractors", value: "ironclad" },
  { label: "Juniper Design Studio", value: "juniper" },
] as const;

type ClientId = (typeof CLIENT_OPTIONS)[number]["value"];

interface JobFormValues {
  title: string;
  client: ClientId | null;
  status: JobStatus;
  value: string;
  startDate: Date;
  dueDate: Date;
  retentionHeld: boolean;
  notes: string;
}

/** Stand-in "load the job" for the template — a real screen would fetch by `jobId`. */
function loadJob(_jobId: string): JobFormValues {
  return {
    title: "Kitchen extension",
    client: "acme",
    status: "in_progress",
    value: "18400.00",
    startDate: new Date("2026-08-01T00:00:00"),
    dueDate: new Date("2026-09-30T00:00:00"),
    retentionHeld: true,
    notes: "",
  };
}

interface FormErrors {
  title?: string;
  client?: string;
  value?: string;
}

function validate(values: JobFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.title.trim()) errors.title = "Title is required.";
  if (!values.client) errors.client = "Client is required.";
  if (!values.value.trim()) {
    errors.value = "Job value is required.";
  } else if (Number.isNaN(Number(values.value)) || Number(values.value) < 0) {
    errors.value = "Enter a valid, non-negative amount.";
  }
  return errors;
}

/**
 * Row-based form redesign (see `Divider`'s own doc comment): a section is
 * now an uppercase caption ABOVE one borderless card, with each field
 * rendered as a `FormRow` and separated by full-bleed `Divider`s inside the
 * card — the card's shared surface is the only chrome; individual fields
 * (`TextField variant="row"`, `NativeTextField variant="row"`,
 * `SelectField`, `SelectListField`) draw no border/background of their
 * own. This replaces the previous layout, where each field was its own
 * bordered box floating in a `gap-4` stack inside one bordered card.
 */
function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
      {children}
      {required ? <Text className="text-overdue dark:text-overdue-dark"> *</Text> : null}
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="px-4 pb-2 text-[12px] text-overdue dark:text-overdue-dark">{message}</Text>;
}

/**
 * A fixed row height, applied identically to every row in a `FormSection`
 * card (text field, select, date picker, switch alike) — a real, reported
 * gap in the first pass of this layout: `FormRow`'s labeled branch used
 * `min-h-11` while the label-omitted branch had no explicit height at all,
 * so each row's actual height came out however tall its own control
 * happened to render (`DateTimePicker`'s compact pill, `NativeTextField`'s
 * system-default text, etc.), producing a visibly uneven row-height rhythm
 * down the card (confirmed on a real device). `ROW_HEIGHT` is deliberately
 * taller than the pre-existing `h-11` (44px) single-line row, since a
 * `FloatingLabelField` row needs room for BOTH the floated label caption
 * and the value text stacked vertically, not just one line — every row
 * (including the plain-label DateTimePicker/Switch ones) now uses this
 * same value so nothing in the card reads as taller or shorter than its
 * neighbors.
 */
const ROW_HEIGHT = 56;

/**
 * One row inside a `FormSection` card, full-bleed `Divider` below (omit on
 * the last row via `last`). Two shapes, both fixed at `ROW_HEIGHT`:
 *
 * - `label` given (DateTimePicker/Switch rows, which are unchanged per
 *   explicit instruction — no floating-label treatment for those two
 *   controls): plain label left, control right, exactly as before.
 * - `label` omitted (every `FloatingLabelField`/floating-`SelectField`/
 *   `SelectListField` row): the field renders its OWN label internally
 *   (see `FloatingLabelField`'s doc comment), so this row is just a
 *   full-width slot with no separate label element — a side-by-side label
 *   here would visually double up with the field's own floating one.
 */
function FormRow({ label, required, children, last }: { label?: string; required?: boolean; children: React.ReactNode; last?: boolean }) {
  return (
    <View>
      {label ? (
        <View style={{ height: ROW_HEIGHT }} className="flex-row items-center justify-between gap-3 px-4">
          <FieldLabel required={required}>{label}</FieldLabel>
          <View className="max-w-[62%] flex-1 items-end">{children}</View>
        </View>
      ) : (
        <View style={{ height: ROW_HEIGHT }} className="justify-center px-4">
          {children}
        </View>
      )}
      {last ? null : <Divider />}
    </View>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <View className="gap-0.5 px-1">
        <Text className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          {title}
        </Text>
        {description ? <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{description}</Text> : null}
      </View>
      {/*
        Card uses `surface` (the lighter/whiter token in both modes) —
        this fixes a real, reported bug, and went through two iterations:
        this screen's own page background is `colors.background` (set via
        inline `style` on `KeyboardAvoidingView` below, resolved from
        `useNativeColors()`), and in LIGHT mode `background` and `surface`
        were BOTH `#FFFFFF` — identical values, so the card was completely
        invisible against the page (no border of its own by design, per
        the borderless-row redesign), leaving the whole form looking
        flat/groupless in light mode on both iOS and Android. Dark mode
        was never affected (`background-dark` #121110 vs `surface-dark`
        #191815 already differ) — this is exactly why the bug went
        unnoticed through this feature's whole development, which was
        tested almost entirely in dark mode. **First fix attempt** swapped
        the CARD to `surface-sunken` (a slightly darker off-white,
        `#FAFAF9`), which technically restored contrast but read as
        "gray card floating on a white page" — backwards from the
        standard iOS/Material grouped-list convention (a gray/sunken PAGE
        behind WHITE cards) and an explicit follow-up request to flip it.
        **Final fix**: the PAGE background (`colors.background`, passed to
        `KeyboardAvoidingView`'s style below) now resolves `surfaceSunken`
        instead of `background` — see that prop's own comment — while the
        card here stays on the normal `surface` token, giving the
        conventional gray-page/white-card look in light mode and matching
        dark mode's own already-correct direction (`background-dark`
        darker than `surface-dark`). Any future card/panel in this app
        should verify its fill is visually distinct from its actual
        parent background in BOTH modes before assuming a token pair like
        `surface`/`background` provides contrast on its own.
      */}
      <View className="rounded-lg bg-surface dark:bg-surface-dark">{children}</View>
    </View>
  );
}

/**
 * Edit template — the "form" screen shape complementing List + Detail and
 * Settings: grouped sections, inline validation, an unsaved-changes guard
 * on back navigation, and a destructive action, all built from real
 * `@spine/ui-native` field components (TextField, SelectField,
 * SelectListField, DateTimePicker, Switch). Shared by two routes — the top-level
 * `app/job-edit/[jobId]` route (reached from a real job's detail screen)
 * and `templates/edit.tsx` (a Templates-tab catalog entry, fixed demo
 * `jobId`) — so the form itself lives here once instead of being
 * duplicated per route.
 *
 * **Save/Delete are PLATFORM-DIVERGENT by design, not an oversight — read
 * this before "fixing" one to match the other.**
 *
 * - **iOS**: real native header items via `unstable_headerRightItems`
 *   (the same mechanism `profile-header-items.tsx` already uses for the
 *   bell/avatar) — a `type: "button"` checkmark (`variant: "done"`, the
 *   genuine iOS convention for a modal-form's primary Save action) plus a
 *   separate `type: "menu"` "•••" item opening a real native menu
 *   (`NativeStackHeaderItemMenu`) containing a single destructive "Delete
 *   job" action. No bottom Cancel/Save footer and no standalone "Delete
 *   job" button render on iOS at all — this was an explicit, requested
 *   redesign (real native header actions instead of a sticky footer,
 *   matching standard iOS form-screen conventions), not a bug fix. Cancel
 *   has NO separate header item on iOS by explicit request — the existing
 *   back chevron (and its already-wired unsaved-changes guard, unchanged)
 *   is the only way back.
 * - **Android**: UNCHANGED — the sticky bottom Cancel/Save footer and the
 *   standalone danger-variant "Delete job" button both still render
 *   exactly as before. Android has no equivalent of iOS's `variant:
 *   "done"` checkmark convention, so this divergence is deliberate scope
 *   ("iOS only for now," per explicit user decision), not a gap to close
 *   reflexively — do not add matching header items on Android without a
 *   separate, explicit request to do so.
 *
 * Both the header checkmark and the header menu's Delete action reflect
 * `saving` via their own `disabled` prop, mirroring what the (now
 * Android-only) footer `Button`s already did — `unstable_headerRightItems`
 * is a plain function re-invoked on every render, so a new array
 * reflecting current `saving` state is exactly what re-renders it.
 *
 * **Form redesign, round 1: borderless row fields inside a shared card,
 * separated by `Divider` — not each field its own bordered box.**
 * `FormSection` renders an uppercase caption above ONE borderless card
 * (`bg-surface`, no border of its own); each field sits in a `FormRow`
 * inside that card, with a full-bleed `Divider` between rows (omitted
 * after the last row via `FormRow`'s `last` prop). `variant="bordered"`
 * (the default on `TextField`/`NativeTextField`/`SelectField`) is
 * unchanged for every other existing consumer outside this form.
 *
 * **Form redesign, round 2: Material-style FLOATING labels on Title,
 * Client, Status, Job value, and Notes — replacing round 1's "plain label
 * left, control right" `FormRow` layout for those five fields
 * specifically, per an explicit follow-up design request.** Each of these
 * now renders via `FloatingLabelField` (Title/Job value/Notes, wrapping
 * `TextField`/`NativeTextField`) or the new `floatingLabel` prop on
 * `SelectField`/`SelectListField` (Status/Client): when empty, the label
 * sits centered in the row acting as the placeholder itself; once
 * focused (text fields) or a value exists, it animates/snaps up to a
 * small caption above the value, which then renders below it in the same
 * row. `FormRow` itself now renders these five with NO `label` prop at
 * all (see its own doc comment) — the field owns its label internally, so
 * a side-by-side `FormRow` label would visually double up with the
 * field's own floating one. Required asterisk lives inside the floating
 * label text (`"Title *"`), in both its resting and floating states;
 * error state tints the label (and the text-field variant's input text)
 * red rather than recoloring a border, same reasoning as round 1's
 * `variant="row"` error treatment. **Start date/Due date/Retention held
 * (DateTimePicker/Switch) are UNCHANGED and still use `FormRow`'s
 * plain-`label` shape** — no floating-label treatment was requested for
 * those two controls, and they have no "empty vs. filled" placeholder
 * state that a floating label would meaningfully apply to.
 *
 * **Title/Job value/Notes' underlying field choice (iOS `NativeTextField`
 * pilot vs. Android `TextField`) is now decided INSIDE `FloatingLabelField`
 * itself** (`Platform.OS === "ios"`, with a `forceTextField` escape hatch —
 * unused by this form, but available to a future call site not ready to
 * adopt the iOS pilot), not branched per-field in this file anymore — round
 * 1's original per-field `Platform.OS` ternary for Title moved into the
 * shared component once Job value/Notes needed the exact same choice.
 * `NativeTextField` gained a genuinely new capability to make this
 * possible: it previously exposed no `onFocus`/`onBlur` at all, so
 * `FloatingLabelField` could not have animated its label for the iOS
 * branch — fixed by wiring `@expo/ui`'s real `onFocusChange` through new
 * `onFocus`/`onBlur` props on `NativeTextField` (see its own doc comment).
 * `FloatingLabelField`'s `inputRef` prop still forwards through to the
 * Android/`TextField` branch's real RN `TextInput` ref, so this screen's
 * `focusedInputRef`/keyboard-scroll mechanism (below) keeps working
 * unchanged for Job value/Notes on Android — Title's iOS branch remains
 * outside that mechanism for the same reason round 1 documented (no
 * forwardable ref on a native-bridge view), which is fine in practice
 * since Title sits near the top of the form, never actually covered by
 * the keyboard.
 *
 * **Client uses `SelectListField`, not `TextField` — a genuinely long list
 * (an org's contacts) needs a searchable popup, not free-text entry or a
 * short native menu.** `SelectListField` (`packages/ui-native`, net-new)
 * renders the same borderless row trigger as every other field here
 * (`variant="row"`, default for this component) but opens a `BottomSheet`
 * with a search box pinned above a filterable, scrollable option list —
 * the standard pattern for a select whose options don't fit a dropdown.
 * Selection-only: there is no inline "create new client" affordance:
 * picking always chooses from the existing contacts list; that's a
 * separate, explicitly-scoped addition if a future screen needs it.
 *
 * **Status uses `SelectField variant="row"`, not `Select` or
 * `SelectListField`** — `Select` (`@expo/ui`'s universal `Picker`) has no
 * border/background style props at all, so it rendered as bare native
 * picker-button chrome, visually inconsistent with the other fields in this
 * form (a real, reported inconsistency). `SelectField` (`packages/ui-native`,
 * net-new) opens a real native menu — appropriate here since Job Status is a
 * short, fixed enum (4 options), unlike Client's long contacts list, which
 * is why Status doesn't use `SelectListField`'s popup-with-search pattern.
 * `variant="row"` was a real, reported gap in the first pass of this
 * redesign: `SelectField` gained a `variant` prop alongside `TextField`'s
 * own, but this call site wasn't updated to use it, so Status kept its old
 * bordered-pill chrome (confirmed on a real device) while every other field
 * in the same card had already gone borderless — an inconsistent-looking
 * card, exactly the thing this redesign was meant to fix. Fixed by passing
 * `variant="row"` here, matching `SelectField`'s own doc comment. Status
 * and Client's `floatingLabel` (round 2) are a STATIC two-state layout, not
 * an animated one like the text fields — neither has a real "focus" state,
 * since tapping opens the menu/sheet immediately rather than an inline
 * edit mode; see `SelectField`/`SelectListField`'s own `floatingLabel` doc
 * comments.
 *
 * `DateTimePicker` renders as a compact, inline control (its fifth design)
 * — laid out in `FormRow`'s plain-`label` shape (label left, control
 * right), same shape as the Retention held row below it. See
 * the component's own doc comment for why the two platforms use a
 * different real popup mechanism under the hood (SwiftUI's native
 * `display="compact"` on iOS, a small trigger opening Android's native
 * dialog) despite presenting the same way, and for the history of an
 * earlier, reverted design (a shared `TextField`-styled trigger opening a
 * `BottomSheet` on iOS) that regressed on real iOS devices — do not
 * reintroduce it.
 *
 * **`KeyboardAvoidingView`'s background/flex sizing is set via `style`, not
 * a NativeWind `className`** — a real, reported bug: `className="flex-1
 * bg-background dark:bg-background-dark"` silently did nothing on this
 * specific component (confirmed by the whole form rendering blank except
 * the sticky footer, and the background staying white in dark mode), the
 * same class of gap CLAUDE.md documents for `DesktopSidebar`'s width.
 * Fixed by resolving `colors.background` via `useNativeColors()` and
 * setting it as an explicit `style.backgroundColor` alongside `flex: 1`.
 *
 * The unsaved-changes guard uses `useNavigation().addListener("beforeRemove", ...)`
 * (React Navigation's own event, re-exported through `expo-router`'s
 * `useNavigation`) rather than a custom back-button override — this is the
 * standard mechanism for intercepting ANY removal of the screen (hardware
 * back, swipe-back gesture, header back button, or a programmatic
 * `router.back()`), not just one of those paths.
 *
 * **Focusing a field near the bottom of the form (Notes especially) hid it
 * behind the keyboard on iOS — a real, reported bug, confirmed still
 * broken after a first fix attempt. Read this before touching the
 * keyboard-scroll logic again.**
 *
 * `KeyboardAvoidingView behavior="padding"` only pads/resizes the view for
 * the keyboard's height; it does NOT auto-scroll a focused `TextInput`
 * into view inside a nested `ScrollView` — that's a separate concern RN
 * leaves to the app.
 *
 * **First attempt (confirmed NOT sufficient, do not revert to it)**: called
 * `ScrollView`'s own `scrollResponderScrollNativeHandleToKeyboard` directly
 * from each field's `onFocus`. This is a real, documented RN API, but RN's
 * OWN source (`ScrollView.js`, `_inputMeasureAndScrollToKeyboard`) admits
 * it races the keyboard's `keyboardWillShow`/`keyboardDidShow` event:
 * `_keyboardMetrics` (the keyboard's height/position, set by that event)
 * "is not guaranteed to be called before" the scroll calculation runs, and
 * RN's own fallback is a same-tick `setTimeout(0)` retry — which can still
 * lose the race on a real device, exactly as reported here.
 *
 * **Current fix**: a `Keyboard.addListener("keyboardWillShow"` (iOS) /
 * `"keyboardDidShow"` (Android)`, ...)` subscription that only runs AFTER
 * the keyboard event has actually fired, guaranteeing real geometry rather
 * than racing for it. On fire, it measures the currently-focused input via
 * `measureInWindow` (tracked in `focusedInputRef`, set by each field's own
 * `onFocus`; each field also gets its own `useRef<TextInput>` since
 * `measureInWindow` needs a real host-component instance, not just the
 * focus event's opaque node-handle number) against the keyboard's own
 * `event.endCoordinates.screenY` (both in the same absolute screen-Y
 * coordinate space) to compute exactly how many pixels of the input are
 * newly hidden — then adds that overlap to the `ScrollView`'s current
 * offset (tracked via its own `onScroll`, since `scrollTo`'s `y` is an
 * ABSOLUTE offset, not a relative scroll-by amount — passing just the
 * overlap directly would scroll to the wrong position for any field below
 * the very top of the form) and scrolls there.
 *
 * Deliberately NOT a new dependency (e.g. `react-native-keyboard-
 * controller`) — no keyboard-handling library exists anywhere in this
 * monorepo yet, and this is achievable with RN's own built-in `Keyboard`/
 * `ScrollView` APIs. Any future `TextField` added to this form (or a
 * similar scrollable form elsewhere) needs its own ref + `onFocus` wiring
 * into this same mechanism — it is NOT automatic just from being inside a
 * `ScrollView`.
 */
export function JobEditForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useNativeColors();
  const { colorScheme } = useColorScheme();
  /**
   * Light mode uses `colors.neutral100` (`#F2F1EE`), not `colors.surfaceSunken`
   * (`#FAFAF9`) — a real, reported follow-up: `surfaceSunken` is only a few
   * points off white, giving barely-visible contrast against the white
   * `surface` cards on top of it (confirmed on a real device — the grouping
   * was technically non-identical but read as almost flat). `neutral100`
   * is a meaningfully darker light-neutral gray, giving clearly visible
   * card/page contrast while staying a neutral (not tinted) background.
   * Dark mode is UNCHANGED (`colors.surfaceSunken`, `#2C2B26`) — it never
   * had a contrast problem (`background`/`surface` already differ well
   * there), so this fix is scoped to light mode only via `colorScheme`,
   * not a global token change to `surfaceSunken` itself (a shared token
   * other consumers may already rely on at its current value).
   */
  const pageBackground = colorScheme === "dark" ? colors.surfaceSunken : colors.neutral100;
  const { message, show, dismiss } = useToast();
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);

  const initialValues = useMemo(() => loadJob(jobId), [jobId]);
  const [values, setValues] = useState<JobFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const isDirty = useRef(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(showEvent, (event) => {
      const input = focusedInputRef.current;
      const scrollView = scrollViewRef.current;
      if (!input || !scrollView) return;

      input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
        const keyboardTop = event.endCoordinates.screenY;
        const inputBottom = inputY + inputHeight;
        const overlap = inputBottom - keyboardTop;
        if (overlap <= 0) return;

        scrollView.scrollTo({ y: scrollOffsetRef.current + overlap + 16, animated: true });
      });
    });

    return () => subscription.remove();
  }, []);

  const titleInputRef = useRef<TextInput>(null);
  const valueInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);

  function handleFieldFocus(input: TextInput | null) {
    focusedInputRef.current = input;
  }

  function update<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    isDirty.current = true;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const confirmDiscard = useCallback((onDiscard: () => void) => {
    Alert.alert("Discard changes?", "You have unsaved changes to this job. Discard them?", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onDiscard },
    ]);
  }, []);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (!isDirty.current || saving) return;
      event.preventDefault();
      confirmDiscard(() => navigation.dispatch(event.data.action));
    });
  }, [navigation, saving, confirmDiscard]);

  function handleCancel() {
    if (isDirty.current) {
      confirmDiscard(() => router.back());
    } else {
      router.back();
    }
  }

  async function handleSave() {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      isDirty.current = false;
      show("Job updated", values.title);
      setTimeout(() => router.back(), 600);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete job?", "This permanently deletes the job and cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          isDirty.current = false;
          router.back();
        },
      },
    ]);
  }

  const iosHeaderRightItems: NativeStackHeaderItem[] = [
    {
      type: "menu",
      label: "More",
      icon: { type: "sfSymbol", name: "ellipsis" },
      accessibilityLabel: "More",
      menu: {
        items: [
          {
            type: "action",
            label: "Delete job",
            icon: { type: "sfSymbol", name: "trash" },
            destructive: true,
            disabled: saving,
            onPress: handleDelete,
          },
        ],
      },
    },
    {
      type: "button",
      label: "Save",
      icon: { type: "sfSymbol", name: "checkmark" },
      accessibilityLabel: "Save",
      variant: "done",
      disabled: saving,
      onPress: handleSave,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: `Edit job #${jobId}`,
          /**
           * `headerTransparent: true` on iOS — deliberately, so the header
           * gets the same free `scrollEdgeEffects` blur-over-scrolled-
           * content Home/Components get on their own (large-title) screens,
           * per explicit request to match that look here too even without a
           * large title.
           *
           * **Just omitting `headerStyle.backgroundColor` (the first thing
           * tried) does NOT make a header translucent on its own — a real
           * finding from reading `expo-router`'s own
           * `useHeaderConfigProps.js`**: its `translucent` value is only
           * ever true when `headerBackground` is set, `headerTransparent`
           * is explicitly true, OR (`hasHeaderSearchBar ||
           * headerLargeTitleEnabled)` — omitting a background color alone
           * changes nothing about translucency. Home/Components' headers
           * only look translucent+blurred because THEY set
           * `headerLargeTitleEnabled: true`, which is what actually flips
           * `translucent` on for them; `scrollEdgeEffects` (separately,
           * `"automatic"` by default) is what then paints the blur once the
           * header is translucent. This screen has no large title (by
           * explicit request — see the `headerLargeTitleEnabled: false`
           * story in `app/_layout.tsx`), so it needs `headerTransparent:
           * true` set explicitly to get the same translucency Home/
           * Components get for free from their large title.
           *
           * Android keeps the explicit `colors.surface` background —
           * Android has no equivalent automatic blur to fall back on, and a
           * transparent/unset header there would just render flat white/
           * native-default, unthemed.
           */
          ...(Platform.OS === "ios"
            ? { headerTransparent: true, unstable_headerRightItems: () => iosHeaderRightItems }
            : { headerStyle: { backgroundColor: colors.surface } }),
        }}
      />
      {/*
        `pageBackground` (computed above — `neutral100` in light mode,
        `surfaceSunken` in dark mode), NOT `colors.background` and NOT a
        flat `colors.surfaceSunken` in both modes — per two rounds of
        explicit follow-up requests: the page behind the form cards should
        read as a gray/sunken shade, with the cards themselves on the
        lighter `surface` token (see `FormSection`'s own comment on this
        same card/page pair) — the conventional iOS/Material grouped-list
        direction. The first attempt used `colors.surfaceSunken` for both
        modes, which was correct in dark mode but too close to white in
        light mode (barely visible contrast, a real reported follow-up) —
        see `pageBackground`'s own comment above for why light mode now
        uses `neutral100` instead. Still set via inline `style`, not a
        NativeWind `className`, since this exact component was confirmed
        (see the history in this file) to silently ignore a
        `className`-set background — unrelated to which token is used,
        just this component's own known quirk.
      */}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: pageBackground }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollViewRef}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: pageBackground }}
          className="flex-1"
          contentContainerClassName="gap-6 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <FormSection title="Details">
            <FormRow>
              <FloatingLabelField
                label="Title"
                required
                value={values.title}
                onChangeText={(text) => update("title", text)}
                onFocus={() => handleFieldFocus(titleInputRef.current)}
                error={!!errors.title}
                inputRef={titleInputRef}
                testID="title-field"
              />
            </FormRow>
            <FieldError message={errors.title} />

            <FormRow>
              <SelectListField
                options={[...CLIENT_OPTIONS]}
                value={values.client}
                onValueChange={(v) => update("client", v)}
                floatingLabel="Client"
                required
                searchPlaceholder="Search clients…"
                sheetTitle="Select client"
                error={!!errors.client}
                variant="row"
                testID="client-select"
              />
            </FormRow>
            <FieldError message={errors.client} />

            <FormRow>
              <SelectField
                options={[...JOB_STATUS_OPTIONS]}
                value={values.status}
                onValueChange={(v) => update("status", v)}
                floatingLabel="Status"
                variant="row"
              />
            </FormRow>

            <FormRow last>
              <FloatingLabelField
                label="Job value"
                required
                value={values.value}
                onChangeText={(text) => update("value", text)}
                onFocus={() => handleFieldFocus(valueInputRef.current)}
                error={!!errors.value}
                keyboardType="decimal"
                inputRef={valueInputRef}
                testID="value-field"
              />
            </FormRow>
            <FieldError message={errors.value} />
          </FormSection>

          <FormSection title="Schedule">
            <FormRow label="Start date">
              <DateTimePicker value={values.startDate} onChange={(date) => update("startDate", date)} mode="date" />
            </FormRow>

            <FormRow label="Due date" last>
              <DateTimePicker value={values.dueDate} onChange={(date) => update("dueDate", date)} mode="date" minimumDate={values.startDate} />
            </FormRow>
          </FormSection>

          <FormSection title="Billing" description="Held retention posts to a dedicated Retention Receivable account, not standard AR.">
            <FormRow label="Retention held" last>
              <Switch value={values.retentionHeld} onValueChange={(v) => update("retentionHeld", v)} />
            </FormRow>
          </FormSection>

          <FormSection title="Notes">
            <View className="px-4 py-1">
              <FloatingLabelField
                label="Notes"
                value={values.notes}
                onChangeText={(text) => update("notes", text)}
                onFocus={() => handleFieldFocus(notesInputRef.current)}
                multiline
                inputRef={notesInputRef}
                testID="notes-field"
              />
            </View>
          </FormSection>

          {Platform.OS === "android" ? (
            <Button variant="danger" onPress={handleDelete} disabled={saving}>
              Delete job
            </Button>
          ) : null}
        </ScrollView>

        {Platform.OS === "android" ? (
          <View className="flex-row gap-3 border-t border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
            <View className="flex-1">
              <Button variant="secondary" onPress={handleCancel} disabled={saving}>
                Cancel
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" label="Saving" /> : "Save"}
              </Button>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {message ? (
        <View className={["absolute left-4 right-4", Platform.OS === "android" ? "bottom-24" : "bottom-8"].join(" ")}>
          <Toast title={message.title} description={message.description} onDismiss={dismiss} />
        </View>
      ) : null}
    </>
  );
}
