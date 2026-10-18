import { render } from "@testing-library/react-native";
import { NativeTextField } from "./native-text-field";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components — `NativeTextField` is iOS-only (no Android branch at all, by
 * explicit scope decision — see the component's own doc comment), so
 * unlike `date-time-picker.a11y.test.tsx`/`select-field.a11y.test.tsx`
 * there is no "on Android" describe block here; `jest-expo`'s default
 * project already resolves `Platform.OS` as `"ios"`.
 *
 * Requires the `ExpoUI.ObservableState` mock installed by this package's
 * own `jest.setup.ts` (registered via `jest.config.js`'s
 * `setupFilesAfterEnv`) — `useNativeState` (used internally to drive
 * `@expo/ui`'s `text` observable) constructs a real `ExpoUI.ObservableState`
 * native-bridge class, which `jest-expo`'s own `expo-modules-core` mock has
 * no built-in stand-in for. See that setup file's own doc comment for the
 * full root cause and the `jest-expo` precedent
 * (`ExpoFetchModule.NativeRequest`/`NativeResponse`) this follows.
 */
function findFieldNode(root: ReturnType<typeof render>) {
  return root.UNSAFE_root.find((n) => "onTextChange" in n.props);
}

describe("NativeTextField a11y", () => {
  it("resolves the design system's own colors, not the platform default", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} />);
    const node = findFieldNode(root);
    const backgroundModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "background");
    expect(backgroundModifier.style.color).toBe("#FFFFFF");
  });

  it("reflects an error state via the border color, not a separate error prop", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} error />);
    const node = findFieldNode(root);
    const borderModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "strokeBorder");
    expect(borderModifier.content).toEqual({ type: "color", color: "#B3261E" });
  });

  it("reflects disabled via a modifier", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} disabled />);
    const node = findFieldNode(root);
    const disabledModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "disabled");
    expect(disabledModifier.disabled).toBe(true);
  });

  it("uses .plain, not .roundedBorder — the system style has no customizable border color", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} />);
    const node = findFieldNode(root);
    const styleModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "textFieldStyle");
    expect(styleModifier.style).toBe("plain");
  });

  it("wires onChangeText through to the native text-change handler", () => {
    const onChangeText = jest.fn();
    const root = render(<NativeTextField value="" onChangeText={onChangeText} />);
    const node = findFieldNode(root);
    expect(typeof node.props.onTextChange).toBe("function");
  });
});
