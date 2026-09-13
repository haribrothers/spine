import { act } from "@testing-library/react-native";
import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useUnsavedChangesGuard, type UnsavedChangesNavigation } from "./use-unsaved-changes-guard";

function createMockNavigation(): UnsavedChangesNavigation & { emitBeforeRemove: (action: unknown) => { defaultPrevented: boolean } } {
  let listener: ((e: { preventDefault: () => void; data: { action: unknown } }) => void) | null = null;
  const dispatch = jest.fn();
  return {
    addListener: (event, callback) => {
      if (event === "beforeRemove") listener = callback;
      return () => {
        listener = null;
      };
    },
    dispatch,
    emitBeforeRemove: (action: unknown) => {
      let defaultPrevented = false;
      listener?.({ preventDefault: () => (defaultPrevented = true), data: { action } });
      return { defaultPrevented };
    },
  };
}

describe("useUnsavedChangesGuard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lets navigation through untouched when the form is not dirty", () => {
    const navigation = createMockNavigation();
    renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => false }));

    const { defaultPrevented } = navigation.emitBeforeRemove("POP");
    expect(defaultPrevented).toBe(false);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("intercepts beforeRemove and shows a confirm alert when dirty", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const navigation = createMockNavigation();
    renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => true }));

    const { defaultPrevented } = navigation.emitBeforeRemove("POP");
    expect(defaultPrevented).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it("dispatches the original action once the alert's discard option is confirmed", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const discard = buttons?.find((b) => b.style === "destructive");
      discard?.onPress?.();
    });
    const navigation = createMockNavigation();
    renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => true }));

    navigation.emitBeforeRemove("POP");
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith("POP");
  });

  it("never intercepts when bypass is true, even while dirty", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const navigation = createMockNavigation();
    renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => true, bypass: true }));

    const { defaultPrevented } = navigation.emitBeforeRemove("POP");
    expect(defaultPrevented).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  describe("confirmAndRun", () => {
    it("runs the callback immediately when not dirty", () => {
      const navigation = createMockNavigation();
      const { result } = renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => false }));
      const onConfirmed = jest.fn();

      act(() => result.current.confirmAndRun(onConfirmed));
      expect(onConfirmed).toHaveBeenCalledTimes(1);
    });

    it("shows a confirm alert and only runs the callback once discard is confirmed, when dirty", () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      const navigation = createMockNavigation();
      const { result } = renderHook(() => useUnsavedChangesGuard(navigation, { isDirty: () => true }));
      const onConfirmed = jest.fn();

      act(() => result.current.confirmAndRun(onConfirmed));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(onConfirmed).not.toHaveBeenCalled();
    });
  });
});
