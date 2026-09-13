import { act, renderHook } from "@testing-library/react-native";
import { Keyboard, Platform, type TextInput } from "react-native";
import { useScrollToFocusedInput } from "./use-scroll-to-focused-input";

/**
 * `jest-expo` mocks `Platform.OS` as `"ios"`, so `useScrollToFocusedInput`
 * subscribes to `"keyboardWillShow"` in these tests — see the hook's own
 * doc comment for why iOS/Android intentionally listen to different event
 * names.
 */
// `Keyboard` has no public `.emit`/test-trigger API — this reaches into its
// private `_emitter` (RN's own internal event emitter backing
// `Keyboard.addListener`), the same one `Keyboard.addListener` itself
// subscribes to under the hood. Confirmed via `Object.keys(Keyboard)`
// under jest-expo: `_emitter` is the only property present at all.
function emitKeyboardShow(screenY: number) {
  act(() => {
    (Keyboard as unknown as { _emitter: { emit: (event: string, data: unknown) => void } })._emitter.emit(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      {
        endCoordinates: { screenY, screenX: 0, width: 0, height: 0 },
        startCoordinates: { screenY, screenX: 0, width: 0, height: 0 },
        duration: 0,
        easing: "keyboard",
      },
    );
  });
}

function createMockInput(y: number, height: number): TextInput {
  return {
    measureInWindow: (callback: (x: number, y_: number, w: number, h: number) => void) => callback(0, y, 100, height),
  } as unknown as TextInput;
}

describe("useScrollToFocusedInput", () => {
  it("scrolls the ScrollView when the keyboard would overlap the focused input", () => {
    const { result } = renderHook(() => useScrollToFocusedInput());
    const scrollTo = jest.fn();
    // @ts-expect-error — assigning a minimal mock ScrollView-shaped ref for this test
    result.current.scrollViewRef.current = { scrollTo };

    result.current.onFocus(createMockInput(700, 50));
    emitKeyboardShow(650);

    expect(scrollTo).toHaveBeenCalledWith({ y: 100 + 16, animated: true });
  });

  it("does nothing when the focused input does not overlap the keyboard", () => {
    const { result } = renderHook(() => useScrollToFocusedInput());
    const scrollTo = jest.fn();
    // @ts-expect-error — assigning a minimal mock ScrollView-shaped ref for this test
    result.current.scrollViewRef.current = { scrollTo };

    result.current.onFocus(createMockInput(100, 50));
    emitKeyboardShow(650);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does nothing when no input has been focused yet", () => {
    const { result } = renderHook(() => useScrollToFocusedInput());
    const scrollTo = jest.fn();
    // @ts-expect-error — assigning a minimal mock ScrollView-shaped ref for this test
    result.current.scrollViewRef.current = { scrollTo };

    emitKeyboardShow(650);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("adds the current scroll offset (tracked via onScroll) to the computed overlap, since scrollTo's y is absolute", () => {
    const { result } = renderHook(() => useScrollToFocusedInput());
    const scrollTo = jest.fn();
    // @ts-expect-error — assigning a minimal mock ScrollView-shaped ref for this test
    result.current.scrollViewRef.current = { scrollTo };

    result.current.scrollViewProps.onScroll({ nativeEvent: { contentOffset: { y: 200, x: 0 } } } as never);
    result.current.onFocus(createMockInput(700, 50));
    emitKeyboardShow(650);

    expect(scrollTo).toHaveBeenCalledWith({ y: 200 + 100 + 16, animated: true });
  });
});
