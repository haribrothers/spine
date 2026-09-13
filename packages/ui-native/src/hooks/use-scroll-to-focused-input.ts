import { useEffect, useRef } from "react";
import { Keyboard, Platform, type NativeSyntheticEvent, type NativeScrollEvent, type ScrollView, type TextInput } from "react-native";

/**
 * The keyboard-avoiding scroll-to-focused-input mechanism originally built
 * for `apps/showcase-native`'s Job Edit template — extracted here so any
 * future scrollable form needs to solve this exact problem only once.
 *
 * **Read this in full before touching the mechanism — a real, reported bug
 * went through two attempts before landing here.** `KeyboardAvoidingView
 * behavior="padding"` only pads/resizes the view for the keyboard's
 * height; it does NOT auto-scroll a focused `TextInput` into view inside a
 * nested `ScrollView` — that's a separate concern RN leaves to the app,
 * and without it, focusing a field near the bottom of a long form (e.g. a
 * multiline Notes field) can end up hidden behind the keyboard entirely.
 *
 * **First attempt (confirmed NOT sufficient, do not revert to it)**: called
 * `ScrollView`'s own `scrollResponderScrollNativeHandleToKeyboard` directly
 * from each field's `onFocus`. This is a real, documented RN API, but RN's
 * OWN source (`ScrollView.js`, `_inputMeasureAndScrollToKeyboard`) admits
 * it races the keyboard's `keyboardWillShow`/`keyboardDidShow` event:
 * `_keyboardMetrics` (the keyboard's height/position, set by that event)
 * "is not guaranteed to be called before" the scroll calculation runs, and
 * RN's own fallback is a same-tick `setTimeout(0)` retry — which can still
 * lose the race on a real device.
 *
 * **This fix**: a `Keyboard.addListener` subscription (`"keyboardWillShow"`
 * on iOS, `"keyboardDidShow"` on Android — the two platforms fire
 * meaningfully different events, unlike the `"Show"` name suggesting one
 * shared event) that only runs AFTER the keyboard event has actually
 * fired, guaranteeing real keyboard geometry rather than racing for it. On
 * fire, it measures the currently-focused input via `measureInWindow`
 * (tracked via `onFocus` below; each field needs its own real `TextInput`
 * ref, since `measureInWindow` needs a real host-component instance, not
 * just a focus event's opaque node-handle number) against the keyboard's
 * own `event.endCoordinates.screenY` (both in the same absolute screen-Y
 * coordinate space) to compute exactly how many pixels of the input are
 * newly hidden — then adds that overlap to the `ScrollView`'s current
 * offset (tracked via `onScroll` below, since `scrollTo`'s `y` is an
 * ABSOLUTE offset, not a relative scroll-by amount — passing just the
 * overlap directly would scroll to the wrong position for any field below
 * the very top of the form) and scrolls there.
 *
 * Deliberately not a wrapper `ScrollView` component — a plain hook keeps
 * this flexible for any `ScrollView`-based form without dictating the
 * screen's own structure. Usage: pass the hook's `scrollViewRef` to your
 * `ScrollView`'s own `ref`, spread `scrollViewProps` onto it (wires
 * `onScroll`/`scrollEventThrottle`), and call `onFocus(inputRef.current)`
 * from each field's own `onFocus` handler (each field needs its own
 * `useRef<TextInput>`, forwarded into the field via its `inputRef` prop —
 * see `apps/showcase-native`'s Job Edit template for a worked example).
 */
export function useScrollToFocusedInput() {
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);

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

  function onFocus(input: TextInput | null) {
    focusedInputRef.current = input;
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }

  return {
    scrollViewRef,
    onFocus,
    scrollViewProps: {
      onScroll,
      scrollEventThrottle: 16,
    },
  };
}
