import { useCallback, useEffect } from "react";
import { Alert } from "react-native";

/**
 * The exact shape this hook actually calls on a React Navigation
 * `navigation` object — deliberately NOT imported from `@react-navigation/
 * native` or `expo-router`'s own types, so this hook adds no new
 * dependency (hard or peer) to `packages/ui-native` at all. Both those
 * packages' real `useNavigation()` return values satisfy this shape
 * structurally (confirmed: `expo-router`'s own `useNavigation` is built
 * directly on top of `@react-navigation/native`'s, re-exposing the same
 * `addListener`/`dispatch` API) — callers pass whatever `useNavigation()`
 * gives them, from either package, unchanged.
 */
export interface UnsavedChangesNavigation {
  addListener(
    event: "beforeRemove",
    callback: (e: { preventDefault: () => void; data: { action: unknown } }) => void,
  ): () => void;
  dispatch(action: unknown): void;
}

export interface UnsavedChangesGuardOptions {
  /** A ref (or plain getter) returning whether the form currently has unsaved changes. */
  isDirty: () => boolean;
  /** When true, the guard never intercepts (e.g. while a save is already in flight). */
  bypass?: boolean;
  title?: string;
  message?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
}

/**
 * The unsaved-changes confirmation guard originally built for
 * `apps/showcase-native`'s Job Edit template — extracted here so any
 * future form screen can reuse the exact same "confirm before losing
 * unsaved changes" behavior instead of re-deriving it.
 *
 * Wires a `beforeRemove` listener on the given `navigation` object (React
 * Navigation's own event for intercepting ANY removal of the screen —
 * hardware back, swipe-back gesture, header back button, or a programmatic
 * `.dispatch()`/router call) that shows a native confirm/discard `Alert`
 * whenever `isDirty()` is true at the moment of removal, and lets the
 * navigation through unchanged when it's false.
 *
 * Also returns `confirmAndRun(onConfirmed)`, a plain function for a
 * screen's OWN custom back button/Cancel action to call directly — **this
 * is required, not optional, for a custom `headerLeft`/back button,** per a
 * real, confirmed bug found building the original Job Edit screen: native-
 * stack's default back button is a genuine native control that starts its
 * pop animation optimistically, before JS's `beforeRemove` listener gets a
 * chance to call `preventDefault()` — the listener still correctly blocks
 * the navigation-state change, but the screen visibly slides away and then
 * back once the alert resolves. A custom back button calling
 * `confirmAndRun` directly sidesteps this: nothing navigates until the
 * check has already resolved, so there's no native animation to race.
 * `confirmAndRun`'s own callback must be the one to actually navigate
 * (e.g. `router.back()`) — this hook has no navigation target of its own.
 */
export function useUnsavedChangesGuard(
  navigation: UnsavedChangesNavigation,
  { isDirty, bypass = false, title = "Discard changes?", message = "You have unsaved changes. Discard them?", keepEditingLabel = "Keep editing", discardLabel = "Discard" }: UnsavedChangesGuardOptions,
) {
  const confirmDiscard = useCallback(
    (onDiscard: () => void) => {
      Alert.alert(title, message, [
        { text: keepEditingLabel, style: "cancel" },
        { text: discardLabel, style: "destructive", onPress: onDiscard },
      ]);
    },
    [title, message, keepEditingLabel, discardLabel],
  );

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (!isDirty() || bypass) return;
      event.preventDefault();
      confirmDiscard(() => navigation.dispatch(event.data.action));
    });
  }, [navigation, isDirty, bypass, confirmDiscard]);

  const confirmAndRun = useCallback(
    (onConfirmed: () => void) => {
      if (isDirty()) {
        confirmDiscard(onConfirmed);
      } else {
        onConfirmed();
      }
    },
    [isDirty, confirmDiscard],
  );

  return { confirmAndRun };
}
