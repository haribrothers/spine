import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useNavigation, useRouter, type NativeStackHeaderBackProps, type NativeStackHeaderItem } from "expo-router";
import { useColorScheme } from "nativewind";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import {
  ContextMenu,
  DateTimePicker,
  Divider,
  FloatingLabelField,
  FullWidthButton,
  SelectField,
  SelectListField,
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

/**
 * Stand-in "the org's contacts" for the template — a real screen would
 * fetch this list. 120 GENERATED entries (not the original hand-written 10)
 * — a deliberate, requested stress test for `SelectListField`'s `FlatList`
 * + search at a realistic "org with a real contacts list" scale, not just
 * enough options to prove the picker opens. Built from two name-part word
 * lists combined pairwise (`CLIENT_NAME_PREFIXES` × `CLIENT_NAME_SUFFIXES`,
 * truncated to 120) rather than lorem-ipsum/numbered placeholders — real
 * company-name-shaped strings exercise the search filter meaningfully
 * (typing "stone" or "build" matches multiple real entries), which "Client
 * 1"..."Client 120" wouldn't.
 */
const CLIENT_NAME_PREFIXES = [
  "Acme",
  "Bright",
  "Coastal",
  "Dunmore",
  "Elmfield",
  "Foster",
  "Granite Peak",
  "Harborview",
  "Ironclad",
  "Juniper",
  "Kestrel",
  "Lakeside",
  "Meridian",
  "Northgate",
  "Oakhurst",
  "Pinnacle",
  "Quarrystone",
  "Ridgeline",
  "Summit",
  "Timberline",
] as const;

const CLIENT_NAME_SUFFIXES = [
  "Contracting Ltd.",
  "Homes",
  "Renovations",
  "& Sons",
  "Developments",
  "Build Group",
  "Construction",
  "Fit-Out",
  "Contractors",
  "Design Studio",
  "Property Group",
  "Builders",
] as const;

const CLIENT_OPTIONS: { label: string; value: string }[] = CLIENT_NAME_PREFIXES.flatMap((prefix, prefixIndex) =>
  CLIENT_NAME_SUFFIXES.map((suffix, suffixIndex) => ({
    label: `${prefix} ${suffix}`,
    value: `client-${prefixIndex}-${suffixIndex}`,
  })),
).slice(0, 120);

type ClientId = string;

interface JobFormValues {
  title: string;
  client: ClientId | null;
  status: JobStatus;
  value: string;
  startDate: Date;
  dueDate: Date;
  /**
   * `mode="datetime"` example field — Start/Due date above are genuinely
   * date-only (a job doesn't start or finish at a specific minute), but a
   * site visit needs both: a real, common form-field shape this template
   * previously had no example of. See `DateTimePicker`'s own doc comment
   * (SIXTH design) for why `datetime` mode needed real fixes on both
   * platforms before this was safe to add here.
   */
  siteVisitAt: Date;
  retentionHeld: boolean;
  notes: string;
}

/** Stand-in "load the job" for the template — a real screen would fetch by `jobId`. */
function loadJob(_jobId: string): JobFormValues {
  return {
    title: "Kitchen extension",
    // "Acme Contracting Ltd." — the first generated CLIENT_OPTIONS entry
    // (prefix index 0, suffix index 0). Not a literal-typed value anymore
    // (see ClientId's own comment) since CLIENT_OPTIONS is generated, so
    // this can't be typo-checked by TypeScript the way the old hand-written
    // "acme" could — kept in sync by construction, not by the type system.
    client: "client-0-0",
    status: "in_progress",
    value: "18400.00",
    startDate: new Date("2026-08-01T00:00:00"),
    dueDate: new Date("2026-09-30T00:00:00"),
    siteVisitAt: new Date("2026-08-05T09:30:00"),
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
 * neighbors. Only the row's OWN control slot is fixed at this height — an
 * error message (see `error` below) is allowed to add real height below
 * it, on top of `ROW_HEIGHT`, rather than being squeezed inside it.
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
 *
 * **`error`, a real fix for a reported bug — this message is now part of
 * the row itself, not a separate sibling element the caller has to
 * remember to place correctly.** The previous shape had a standalone
 * `FieldError` component called AFTER a `FormRow`, as an unrelated sibling
 * in `FormSection`'s children list. That broke in a few concrete,
 * user-reported ways: (1) `FormRow` always draws its own trailing
 * `Divider` immediately after itself, so the divider landed BETWEEN the
 * row and its error message instead of below the error — visually, the
 * error text read as belonging to the NEXT field, not the one that
 * actually failed; (2) the error text had no relationship to `ROW_HEIGHT`
 * at all, so it broke the card's carefully-unified row-height rhythm the
 * moment any field errored; (3) two independent call sites
 * (`error={!!errors.x}` on the field itself, `<FieldError
 * message={errors.x} />` as a sibling) had to be kept in sync by hand for
 * every single validated field, with no structural link between them.
 * Fixed by making the row own its error entirely: rendered AFTER
 * `children` but BEFORE this row's own trailing `Divider`, so the divider
 * is always genuinely below the full row+error unit. Deliberately NOT
 * given a fixed height (unlike the row's own control slot) — the answer,
 * per explicit design decision, is that a validation error should only
 * ever affect the layout of the ONE row it belongs to, not reserve
 * permanent empty space in every row up front or shift unrelated rows
 * (this is why there's no fixed-height "error slot" here, on purpose).
 */
function FormRow({
  label,
  required,
  children,
  last,
  error,
}: {
  label?: string;
  required?: boolean;
  children: React.ReactNode;
  last?: boolean;
  error?: string;
}) {
  return (
    <View>
      {label ? (
        <View style={{ height: ROW_HEIGHT }} className="flex-row items-center justify-between gap-3 px-4">
          <FieldLabel required={required}>{label}</FieldLabel>
          <View className="flex-1 items-end">{children}</View>
        </View>
      ) : (
        <View style={{ height: ROW_HEIGHT }} className="justify-center px-4">
          {children}
        </View>
      )}
      {error ? <Text className="px-4 pb-2 text-[12px] text-overdue dark:text-overdue-dark">{error}</Text> : null}
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
 *   has NO separate header item on iOS by explicit request — the back
 *   chevron is the only way back.
 *
 *   **The back chevron is now a CUSTOM `headerLeft`, not native-stack's
 *   default back button — a real, user-reported bug fix, not a stylistic
 *   choice.** With the default native back button, the unsaved-changes
 *   `beforeRemove` guard (`useNavigation().addListener("beforeRemove", ...)`,
 *   below) technically still intercepted the navigation state change, but
 *   VISUALLY the discard-confirmation `Alert` appeared AFTER the screen had
 *   already slid away — because a native-stack back button is a genuine
 *   `UIKit` control that starts its pop animation optimistically, before JS
 *   gets a chance to call `event.preventDefault()`; `beforeRemove` still
 *   correctly blocks the actual navigation-state change, so the screen then
 *   slides back into place once the alert resolves, but that whole
 *   slide-away-then-back motion is exactly the "confirms after the screen
 *   closes" bug that was reported. A custom `headerLeft` sidesteps this
 *   entirely by running the SAME discard-check `handleCancel` already used
 *   for the (Android-only) footer Cancel button synchronously, BEFORE any
 *   pop starts — there's no native animation to race against, since nothing
 *   navigates until the check has already resolved. Styled to visually
 *   match the native chevron it replaces (`ChevronLeftIcon`, `tintColor`
 *   forwarded from `headerLeft`'s own render props so it follows the same
 *   color native-stack would have used).
 *
 *   **This surfaced a SECOND real bug, also fixed here: the discard alert
 *   appeared TWICE in a row after confirming once.** `handleCancel`'s own
 *   `confirmDiscard` call shows the first alert; confirming it called
 *   `router.back()`, which — since `isDirty.current` was never cleared —
 *   the still-armed `beforeRemove` listener (below) intercepted AGAIN and
 *   showed a second alert for the exact same discard. Fixed by clearing
 *   `isDirty.current = false` inside `handleCancel`'s own discard callback,
 *   before calling `router.back()` — the listener then sees a clean form
 *   and lets the navigation through without re-prompting. This bug existed
 *   whether or not the custom `headerLeft` above was in play; it was only
 *   surfaced by testing this exact path more.
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
      // Clear the dirty flag BEFORE navigating — a real, reported bug: the
      // `beforeRemove` listener below is still armed for the `router.back()`
      // this triggers, and without clearing `isDirty.current` first it sees
      // the screen is still dirty and shows a SECOND discard alert right
      // after the user already confirmed the first one.
      confirmDiscard(() => {
        isDirty.current = false;
        router.back();
      });
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
            ? {
                headerTransparent: true,
                unstable_headerRightItems: () => iosHeaderRightItems,
                // Custom back button — see this component's own doc comment
                // ("The back chevron is now a CUSTOM `headerLeft`...") for
                // why: native-stack's default back button starts its pop
                // animation before `beforeRemove` can intercept it, so the
                // discard-confirmation alert visibly appeared AFTER the
                // screen had already slid away. Running the same
                // `handleCancel` discard-check synchronously here, before
                // any navigation starts, fixes that race entirely.
                headerLeft: ({ tintColor }: NativeStackHeaderBackProps) => (
                  <Pressable onPress={handleCancel} hitSlop={8} accessibilityLabel="Back" accessibilityRole="button">
                    <ChevronLeftIcon size={26} color={(tintColor as string | undefined) ?? colors.onSurface} />
                  </Pressable>
                ),
              }
            : {
                headerStyle: { backgroundColor: colors.surface },
                /**
                 * Android has no equivalent of iOS's `unstable_headerRightItems`
                 * — that API is explicitly `@platform ios`-only per
                 * `expo-router`'s own type declarations (its `icon` prop only
                 * accepts an SF Symbol or static image, nothing Android has a
                 * concept of). So Android's Save + "More → Delete job" header
                 * actions are built from the older, genuinely cross-platform
                 * `headerRight` render-function API instead — a plain check
                 * icon `Pressable` for Save, then `ContextMenu`
                 * (`packages/ui-native`'s existing `@expo/ui/community/menu`
                 * wrapper, a real Jetpack Compose `DropdownMenu` on this
                 * platform) around a "⋮" icon `Pressable` for the overflow,
                 * matching `profile-header-items.tsx`'s own established
                 * Android-`headerRight` icon-button pattern (plain Lucide
                 * icon, `colors.onSurface` tint, 22px, 16px gap, 8px hitSlop)
                 * rather than inventing a new one.
                 */
                headerRight: () => (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <ContextMenu
                      actions={[{ id: "delete", title: "Delete job", destructive: true, disabled: saving }]}
                      onPressAction={(id) => {
                        if (id === "delete") handleDelete();
                      }}
                      shouldOpenOnLongPress={false}
                    >
                      {/*
                        A plain `View`, NOT a `Pressable`, as `ContextMenu`'s
                        child — a real bug found on-device: `MenuView`
                        (`@expo/ui/community/menu`) already wraps its
                        `children` in its OWN internal `Pressable` (whose
                        `onPress` is what opens the menu, since
                        `shouldOpenOnLongPress={false}` routes it there
                        rather than `onLongPress`); nesting a second,
                        handler-less `Pressable` inside that swallowed the
                        touch as its own responder before it could reach the
                        outer one, so tapping the icon did nothing at all.
                      */}
                      <View accessibilityLabel="More" hitSlop={8}>
                        <EllipsisVerticalIcon size={22} color={colors.onSurface} />
                      </View>
                    </ContextMenu>
                    <Pressable onPress={handleSave} disabled={saving} accessibilityLabel="Save" hitSlop={8}>
                      <CheckIcon size={22} color={colors.onSurface} />
                    </Pressable>
                  </View>
                ),
              }),
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
            <FormRow error={errors.title}>
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

            <FormRow error={errors.client}>
              <SelectListField
                options={CLIENT_OPTIONS}
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

            <FormRow>
              <SelectField
                options={[...JOB_STATUS_OPTIONS]}
                value={values.status}
                onValueChange={(v) => update("status", v)}
                floatingLabel="Status"
                variant="row"
              />
            </FormRow>

            <FormRow last error={errors.value}>
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
          </FormSection>

          <FormSection title="Schedule">
            <FormRow label="Start date" >
              <DateTimePicker value={values.startDate}  onChange={(date) => update("startDate", date)} mode="date" />
            </FormRow>

            <FormRow label="Due date">
              <DateTimePicker disabled={true} value={values.dueDate} onChange={(date) => update("dueDate", date)} mode="date" minimumDate={values.startDate} />
            </FormRow>

            {/*
              `mode="datetime"` example — a real field genuinely needing
              both a date AND a time (unlike Start/Due date above, which
              are date-only on purpose). Confirms the SIXTH design's
              both-platforms `datetime` fix on a real screen, not just in
              `DateTimePicker`'s own a11y tests: on iOS this renders as one
              combined SwiftUI picker; on Android, tapping opens the date
              dialog first, then the time dialog, merging both into one
              `Date` — see `DateTimePicker`'s own doc comment for the full
              mechanism.
            */}
            <FormRow label="Site visit" last>
              <DateTimePicker value={values.siteVisitAt} onChange={(date) => update("siteVisitAt", date)} mode="datetime" minimumDate={values.startDate} />
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

          {/*
            In-content Save/Cancel, below Notes, on BOTH platforms — per
            explicit request, in addition to (not instead of) the header
            Save action above. Both Saves call the same `handleSave`; this
            is just a second, always-visible affordance for the same action,
            a common iOS form-sheet pattern (header checkmark + a visible
            primary button) now also requested for Android. Cancel calls the
            existing `handleCancel`, which already runs the unsaved-changes
            discard guard before navigating back — relocated here unchanged,
            not reimplemented. This REPLACES the old sticky bottom
            Cancel/Save footer and the standalone "Delete job" button
            (Android only, previously rendered here and in a footer below
            the `ScrollView`) — Delete now lives in the header's "More" menu
            on both platforms, matching iOS's existing shape.
          */}
          <View className="gap-3">
            {/*
              `FullWidthButton`, not `Button` — `Button`'s `fullWidth` was
              tried first and reverted: it's a real, confirmed `@expo/ui`
              upstream limitation (an outer `.frame(width:)` on a
              `.buttonStyle(.borderedProminent)` Button constrains only the
              invisible layout box, never the visually-painted pill — see
              `full-width-button.tsx`'s own doc comment for the full
              investigation trail). `FullWidthButton` is `label`-only (no
              custom `children`), so the Saving state swaps the label text
              instead of swapping in a `Spinner` element.

              `shape="rounded"` (added per explicit request) — matches the
              design intent from the very first attempt at this (a
              `Button`-level `shape="rounded"` prop that turned out not to
              render at all, since `clipShape` was the wrong mechanism —
              see `full-width-button.tsx`'s doc comment for the working
              `buttonBorderShape`/Compose-`shape` mechanism this actually
              uses). Also incidentally fixed a follow-up report that the
              `gap-3` spacing between Save/Cancel looked different on iOS
              vs. Android: the previous full-pill shape's visible edge sat
              further inward from its own layout bounds than the
              rounded-rect shape does, so the identical numeric gap looked
              uneven between platforms purely as a side effect of the shape
              mismatch, not the gap value itself.
            */}
            <FullWidthButton label={saving ? "Saving…" : "Save"} controlSize="large" onPress={handleSave} disabled={saving} shape="rounded" />
            <FullWidthButton label="Cancel" variant="secondary" controlSize="large" onPress={handleCancel} disabled={saving} shape="rounded" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/*
        `bottom-8` on BOTH platforms now — previously Android needed
        `bottom-24` specifically to clear the sticky Cancel/Save footer that
        used to render below the ScrollView; that footer is gone (Save/
        Cancel moved in-content, below Notes), so there's no longer a
        platform-specific bar to clear here.
      */}
      {message ? (
        <View className="absolute bottom-8 left-4 right-4">
          <Toast title={message.title} description={message.description} onDismiss={dismiss} />
        </View>
      ) : null}
    </>
  );
}
