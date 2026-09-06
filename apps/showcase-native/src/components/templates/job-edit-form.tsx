import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useNavigation, useRouter, type NativeStackHeaderItem } from "expo-router";
import { Button, DateTimePicker, NativeTextField, SelectField, Spinner, Switch, TextField, Toast, useNativeColors, useToast } from "@spine/ui-native";

const JOB_STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "On hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
] as const;

type JobStatus = (typeof JOB_STATUS_OPTIONS)[number]["value"];

interface JobFormValues {
  title: string;
  client: string;
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
    client: "Acme Contracting Ltd.",
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
  if (!values.client.trim()) errors.client = "Client is required.";
  if (!values.value.trim()) {
    errors.value = "Job value is required.";
  } else if (Number.isNaN(Number(values.value)) || Number(values.value) < 0) {
    errors.value = "Enter a valid, non-negative amount.";
  }
  return errors;
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text className="text-[13px] font-semibold text-on-surface-muted dark:text-on-surface-muted-dark">
      {children}
      {required ? <Text className="text-overdue dark:text-overdue-dark"> *</Text> : null}
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="text-[12px] text-overdue dark:text-overdue-dark">{message}</Text>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          {title}
        </Text>
        {description ? <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{description}</Text> : null}
      </View>
      <View className="gap-4 rounded-lg border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">{children}</View>
    </View>
  );
}

/**
 * Edit template — the "form" screen shape complementing List + Detail and
 * Settings: grouped sections, inline validation, an unsaved-changes guard
 * on back navigation, and a destructive action, all built from real
 * `@spine/ui-native` field components (TextField, SelectField,
 * DateTimePicker, Switch). Shared by two routes — the top-level
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
 * **Title uses `NativeTextField`, the other text fields (Client/Job value/
 * Notes) still use `TextField` — a deliberate, scoped PILOT, not a partial
 * migration left unfinished.** `NativeTextField` (`packages/ui-native`,
 * net-new) is a genuinely native field — real SwiftUI `TextField`/
 * Material3 `OutlinedTextField`, colored with this design system's own
 * tokens — being piloted on exactly one field before any decision to
 * convert the rest of this form or any other screen. It has no forwarded
 * `TextInput` ref (it's a native-bridge view, not an RN `TextInput`), so it
 * deliberately isn't wired into this screen's `focusedInputRef`/
 * `scrollFocusedFieldIntoView` keyboard-scroll mechanism — Title sitting
 * near the top of the form is never actually covered by the keyboard in
 * practice, which is why it was chosen for this pilot specifically. Do not
 * convert Client/Job value/Notes to `NativeTextField` without first
 * resolving how keyboard-scroll-into-view should work for a native-bridge
 * field with no measurable RN ref — that's an open problem this pilot
 * intentionally deferred, not one it solved.
 *
 * **Status uses `SelectField`, not `Select`** — `Select` (`@expo/ui`'s
 * universal `Picker`) has no border/background style props at all, so it
 * rendered as bare native picker-button chrome, visually inconsistent with
 * the `TextField`s in the same form (a real, reported inconsistency).
 * `SelectField` (`packages/ui-native`, net-new) matches `TextField`'s
 * border/height/radius exactly while still opening a real native menu.
 *
 * `DateTimePicker` renders as a compact, inline control (its fifth design)
 * — laid out in a `Switch`-style row here (`flex-row items-center
 * justify-between`, label left, control right), same shape as the
 * Retention held row below it. See the component's own doc comment for why
 * the two platforms use a different real popup mechanism under the hood
 * (SwiftUI's native `display="compact"` on iOS, a small trigger opening
 * Android's native dialog) despite presenting the same way, and for the
 * history of an earlier, reverted design (a shared `TextField`-styled
 * trigger opening a `BottomSheet` on iOS) that regressed on real iOS
 * devices — do not reintroduce it.
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

  const clientInputRef = useRef<TextInput>(null);
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
          headerStyle: { backgroundColor: colors.surface },
          ...(Platform.OS === "ios" ? { unstable_headerRightItems: () => iosHeaderRightItems } : undefined),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollViewRef}
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="gap-6 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <FormSection title="Details">
            <View className="gap-1.5">
              <FieldLabel required>Title</FieldLabel>
              <NativeTextField value={values.title} onChangeText={(text) => update("title", text)} error={!!errors.title} testID="title-field" />
              <FieldError message={errors.title} />
            </View>

            <View className="gap-1.5">
              <FieldLabel required>Client</FieldLabel>
              <TextField
                ref={clientInputRef}
                value={values.client}
                onChangeText={(text) => update("client", text)}
                onFocus={() => handleFieldFocus(clientInputRef.current)}
                error={!!errors.client}
                accessibilityLabel="Client"
              />
              <FieldError message={errors.client} />
            </View>

            <View className="gap-1.5">
              <FieldLabel>Status</FieldLabel>
              <SelectField options={[...JOB_STATUS_OPTIONS]} value={values.status} onValueChange={(v) => update("status", v)} />
            </View>

            <View className="gap-1.5">
              <FieldLabel required>Job value</FieldLabel>
              <TextField
                ref={valueInputRef}
                value={values.value}
                onChangeText={(text) => update("value", text)}
                onFocus={() => handleFieldFocus(valueInputRef.current)}
                error={!!errors.value}
                keyboardType="decimal-pad"
                accessibilityLabel="Job value"
              />
              <FieldError message={errors.value} />
            </View>
          </FormSection>

          <FormSection title="Schedule">
            <View className="flex-row items-center justify-between">
              <FieldLabel>Start date</FieldLabel>
              <DateTimePicker value={values.startDate} onChange={(date) => update("startDate", date)} mode="date" />
            </View>

            <View className="flex-row items-center justify-between">
              <FieldLabel>Due date</FieldLabel>
              <DateTimePicker value={values.dueDate} onChange={(date) => update("dueDate", date)} mode="date" minimumDate={values.startDate} />
            </View>
          </FormSection>

          <FormSection title="Billing" description="Held retention posts to a dedicated Retention Receivable account, not standard AR.">
            <View className="flex-row items-center justify-between">
              <FieldLabel>Retention held</FieldLabel>
              <Switch value={values.retentionHeld} onValueChange={(v) => update("retentionHeld", v)} />
            </View>
          </FormSection>

          <FormSection title="Notes">
            <TextField
              ref={notesInputRef}
              value={values.notes}
              onChangeText={(text) => update("notes", text)}
              onFocus={() => handleFieldFocus(notesInputRef.current)}
              placeholder="Internal notes about this job…"
              multiline
              numberOfLines={4}
              className="h-24 py-2.5"
              accessibilityLabel="Notes"
            />
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
