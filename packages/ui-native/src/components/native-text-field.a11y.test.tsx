import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { NativeTextField } from "./native-text-field";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components — `screen.debug()` confirmed both platforms render a single
 * `ViewManagerAdapter_ExpoUI` node carrying the resolved props/modifiers,
 * found via `UNSAFE_root.findAll`/`getByProps` on a distinguishing prop
 * rather than by role or text.
 *
 * Requires the `ExpoUI.ObservableState` mock installed by this package's
 * own `jest.setup.ts` (registered via `jest.config.js`'s
 * `setupFilesAfterEnv`) — `useNativeState` (used internally to drive
 * `@expo/ui`'s `text`/`value` observable) constructs a real
 * `ExpoUI.ObservableState` native-bridge class, which `jest-expo`'s own
 * `expo-modules-core` mock has no built-in stand-in for. See that setup
 * file's own doc comment for the full root cause and the `jest-expo`
 * precedent (`ExpoFetchModule.NativeRequest`/`NativeResponse`) this
 * follows.
 *
 * `jest-expo`'s default project (this package's only one, per
 * `jest.config.js`) resolves `Platform.OS` as `"ios"` — the iOS-branch
 * tests below run under that default; the "on Android" describe block
 * overrides it explicitly, same pattern as `date-time-picker.a11y.test.tsx`.
 */
function findIOSFieldNode(root: ReturnType<typeof render>) {
  return root.UNSAFE_root.find((n) => "onTextChange" in n.props);
}

function findAndroidFieldNode(root: ReturnType<typeof render>) {
  return root.UNSAFE_root.find((n) => "onValueChange" in n.props);
}

describe("NativeTextField a11y", () => {
  it("resolves the design system's own colors, not platform defaults", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} />);
    const node = findIOSFieldNode(root);
    const backgroundModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "background");
    expect(backgroundModifier.style.color).toBe("#FFFFFF");
  });

  it("reflects an error state via the border color, not a separate error prop", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} error />);
    const node = findIOSFieldNode(root);
    const borderModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "strokeBorder");
    expect(borderModifier.color).toBe("#B3261E");
  });

  it("reflects disabled via a modifier", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} disabled />);
    const node = findIOSFieldNode(root);
    const disabledModifier = node.props.modifiers.find((m: { $type: string }) => m.$type === "disabled");
    expect(disabledModifier.disabled).toBe(true);
  });

  it("wires onChangeText through to the native text-change handler", () => {
    const onChangeText = jest.fn();
    const root = render(<NativeTextField value="" onChangeText={onChangeText} />);
    const node = findIOSFieldNode(root);
    expect(typeof node.props.onTextChange).toBe("function");
  });
});

describe("NativeTextField a11y — on Android", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("resolves the design system's own colors via the Material TextFieldColors map", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} />);
    const node = findAndroidFieldNode(root);
    expect(node.props.colors.unfocusedIndicatorColor).toBe("#D3D0C9");
    expect(node.props.colors.focusedIndicatorColor).toBe("#2954E5");
  });

  it("reflects an error state via isError and the error indicator color", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} error />);
    const node = findAndroidFieldNode(root);
    expect(node.props.isError).toBe(true);
    expect(node.props.colors.errorIndicatorColor).toBe("#B3261E");
  });

  it("reflects disabled via enabled={false}", () => {
    const root = render(<NativeTextField value="" onChangeText={() => {}} disabled />);
    const node = findAndroidFieldNode(root);
    expect(node.props.enabled).toBe(false);
  });

  it("wires onChangeText through to the native value-change handler", () => {
    const onChangeText = jest.fn();
    const root = render(<NativeTextField value="" onChangeText={onChangeText} />);
    const node = findAndroidFieldNode(root);
    expect(typeof node.props.onValueChange).toBe("function");
  });
});
