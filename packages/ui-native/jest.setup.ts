/**
 * `@expo/ui`'s `useNativeState` (`NativeTextField`'s underlying observable
 * text state) constructs `ExpoUI.ObservableState` — a real native-bridge
 * `SharedObject` class. `jest-expo`'s own `expo-modules-core` mock
 * (`preset/setup.js`) only reconstructs a native module's members from
 * whatever real metadata it can introspect, which doesn't include a
 * JS-constructible `ObservableState` class — so under jest this threw
 * `ExpoUI.ObservableState is not a constructor`, a real gap (not specific
 * to this repo), confirmed by reading `@expo/ui`'s own `useNativeState.ts`
 * (`new ExpoUI.ObservableState({ value: ... })`) and jest-expo's mock
 * machinery directly.
 *
 * `jest-expo`'s OWN setup file establishes the precedent for fixing exactly
 * this shape of gap: it augments `globalThis.expo.modules.ExpoFetchModule`
 * with hand-written stub classes (`NativeRequest`/`NativeResponse`, both
 * `extends globalThis.expo.SharedObject`) immediately after installing its
 * `expo-modules-core` mock, specifically because `expo/fetch` defines
 * `class FetchResponse extends ExpoFetchModule.NativeResponse` at module
 * load time with no native module mock available. This file does the same
 * thing for `ExpoUI.ObservableState`: a plain class extending
 * `globalThis.expo.SharedObject` with a real, working `value`/`get`/`set`
 * (backed by a simple closed-over variable, not any native bridge) so
 * `useNativeState`'s `defineValueProperty`/`defineOnChangeProperty` helpers
 * (which only ever call `.getValue()`/`.setValue()`/`.setOnChange()` on the
 * instance) work correctly under test — this mock does NOT need to
 * simulate any actual native behavior, since we're only exercising
 * `NativeTextField`'s OWN React-level logic (the `useEffect` sync from the
 * `value` prop, the `onTextChange` callback wiring), not `@expo/ui`'s
 * native implementation.
 *
 * Runs via `setupFilesAfterEnv`, same as the existing
 * `@testing-library/jest-native/extend-expect` entry — AFTER jest-expo's
 * own `expo-modules-core` mock has already run (that mock installs via
 * `jest.doMock` inside jest-expo's preset `setup.js`, which Jest always
 * runs before `setupFilesAfterEnv` files), so `globalThis.expo.modules`
 * and `globalThis.expo.SharedObject` are both already populated by the
 * time this file augments them further.
 */
class MockObservableState {
  private _value: unknown;
  onChange: ((value: unknown) => void) | null = null;

  constructor({ value }: { value: unknown }) {
    this._value = value;
  }

  getValue() {
    return this._value;
  }

  setValue({ value }: { value: unknown }) {
    this._value = value;
  }

  get value() {
    return this._value;
  }

  set value(next: unknown) {
    this._value = next;
  }

  get() {
    return this._value;
  }

  set(next: unknown) {
    this._value = next;
  }

  setOnChange(callback: ((value: unknown) => void) | null) {
    this.onChange = callback;
  }

  // `useReleasingSharedObject`'s unmount teardown calls `.release()` on
  // every shared object it created — a real `SharedObject` frees its
  // native-side resources there; this mock has none to free, but still
  // needs the method to exist or unmounting a component using
  // `useNativeState` throws during test cleanup.
  release() {}
}

const globalExpo = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo;
if (globalExpo?.modules) {
  globalExpo.modules.ExpoUI = {
    ...(globalExpo.modules.ExpoUI as Record<string, unknown> | undefined),
    ObservableState: MockObservableState,
  };
}
