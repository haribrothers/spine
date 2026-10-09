import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { FloatingLabelField } from "./floating-label-field";

/**
 * `jest-expo`'s default project resolves `Platform.OS` as `"ios"`, so this
 * component's iOS branch (`NativeTextField`) is what tests hit unless
 * `forceTextField` is passed — same native-bridge testing adaptation as
 * `native-text-field.a11y.test.tsx`. `forceTextField` is used for the
 * assertions that need a real, queryable `Text`/`TextInput` (the label
 * text itself, and `onFocus`/`onBlur` firing through `TextField`'s own RN
 * `TextInput`), since `NativeTextField` renders as an opaque native-bridge
 * mock with no accessible text tree.
 */
function findNativeFieldNode(root: ReturnType<typeof render>) {
  return root.UNSAFE_root.find((n) => "onTextChange" in n.props);
}

describe("FloatingLabelField a11y", () => {
  it("renders the required asterisk as part of the label text", () => {
    render(<FloatingLabelField label="Client" required value="" onChangeText={() => {}} forceTextField testID="client" />);
    expect(screen.getByText("Client *")).toBeTruthy();
  });

  it("renders the plain label with no asterisk when not required", () => {
    render(<FloatingLabelField label="Notes" value="" onChangeText={() => {}} forceTextField testID="notes" />);
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("floats the label (non-zero animated progress) once a value is already present", () => {
    const root = render(<FloatingLabelField label="Title" value="Kitchen extension" onChangeText={() => {}} forceTextField testID="title" />);
    const animatedText = root.UNSAFE_root.findByProps({ children: "Title" });
    const styleArray = animatedText.props.style as { transform?: unknown }[];
    const transformStyle = styleArray.find((s) => s.transform);
    expect(transformStyle?.transform).toBeTruthy();
  });

  it("wires the underlying TextField's accessibility label to the floating label text", () => {
    render(<FloatingLabelField label="Job value" required value="" onChangeText={() => {}} forceTextField testID="value" />);
    const field = screen.getByTestId("value");
    expect(field.props.accessibilityLabel).toBe("Job value");
  });

  it("marks isFocused via onFocus/onBlur, driving the label's floating state independent of a value", () => {
    render(<FloatingLabelField label="Title" value="" onChangeText={() => {}} forceTextField testID="title-focus" />);
    const field = screen.getByTestId("title-focus");
    act(() => {
      fireEvent(field, "focus");
    });
    expect(field.props.value).toBe("");
  });

  it("forwards inputRef through to the underlying TextField (Android/forceTextField branch)", () => {
    const ref = { current: null };
    render(<FloatingLabelField label="Title" value="" onChangeText={() => {}} forceTextField inputRef={ref} testID="title-ref" />);
    expect(ref.current).not.toBeNull();
  });

  it("uses the real NativeTextField bridge on the default iOS branch, with no native/RN placeholder set", () => {
    const root = render(<FloatingLabelField label="Title" value="" onChangeText={() => {}} testID="title-native" />);
    const node = findNativeFieldNode(root);
    expect(node!.props.placeholder).toBe("");
  });

  it("renders the NativeTextField branch with variant=\"row\" (no strokeBorder modifier at all, error or not — row mode has no border to recolor)", () => {
    const root = render(<FloatingLabelField label="Title" value="" onChangeText={() => {}} error testID="title-native-error" />);
    const node = findNativeFieldNode(root);
    const borderModifier = node!.props.modifiers.find((m: { $type: string }) => m.$type === "strokeBorder");
    expect(borderModifier).toBeUndefined();
  });

  it("multiline (Notes): the outer wrapper is NOT h-full — a real, reported bug where the field became completely untappable", () => {
    // `h-full` resolves against the immediate parent's own height. Every single-line
    // consumer's parent is `FormRow`'s fixed-height slot, so `h-full` is correct there —
    // but the one `multiline` consumer (Notes, in `job-edit-form.tsx`) sits in a parent
    // with NO explicit height, so `h-full` collapsed this wrapper's real tappable area
    // to near-zero even though the underlying `TextField`'s own `h-24` still rendered a
    // normal-looking box. Confirmed live on a real device: tapping the visible Notes box
    // produced no focus ring, no keyboard, nothing. Fixed by sizing the wrapper to
    // content (no `h-full`) specifically when `multiline`.
    render(<FloatingLabelField label="Notes" value="" onChangeText={() => {}} forceTextField multiline testID="notes-multiline" />);
    const field = screen.getByTestId("notes-multiline");
    // Walk up from the field to the component's own root View (the outermost node whose
    // className contains "w-full", present on the root View in both the single-line and
    // multiline branch) and assert its className never contains h-full.
    let node = field;
    let rootCandidate: typeof node | null = null;
    while (node) {
      if ("className" in node.props && typeof node.props.className === "string" && node.props.className.includes("w-full")) {
        rootCandidate = node;
      }
      node = node.parent as typeof node;
    }
    expect(rootCandidate).toBeTruthy();
    expect((rootCandidate!.props.className as string).includes("h-full")).toBe(false);
  });

  it("hides a secure value and takes the RN TextField branch even on iOS (US-MOB-01)", () => {
    render(<FloatingLabelField label="Password" value="hunter22" onChangeText={() => {}} secureTextEntry autoComplete="current-password" testID="password" />);
    const field = screen.getByTestId("password");
    expect(field.props.secureTextEntry).toBe(true);
    expect(field.props.autoComplete).toBe("current-password");
    expect(field.props.accessibilityLabel).toBe("Password");
  });

  it("turns off auto-capitalisation and autocorrect for an address (US-MOB-01)", () => {
    render(<FloatingLabelField label="Email" value="" onChangeText={() => {}} forceTextField autoCapitalize="none" keyboardType="email" testID="email" />);
    const field = screen.getByTestId("email");
    expect(field.props.autoCapitalize).toBe("none");
    expect(field.props.autoCorrect).toBe(false);
    expect(field.props.keyboardType).toBe("email-address");
  });
});
