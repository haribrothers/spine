import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { DateTimePicker } from "./date-time-picker";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components. `@expo/ui`'s own `DateTimePicker` translates several props
 * (`accentColor`, `disabled`) into `modifiers` internally rather than
 * plain props (confirmed live via `screen.debug()`) — this wrapper just
 * passes them straight through, so the assertions check the resulting
 * `tint`/`disabled` modifiers `@expo/ui` itself produces.
 *
 * `jest-expo`'s default project (this package's only one, per
 * `jest.config.js`) resolves `Platform.OS` as `"ios"`, so every test below
 * exercises the iOS branch — an always-mounted `ExpoDateTimePicker` with
 * `display="compact"` (the fifth design; a small native pill that pops its
 * own built-in overlay, no custom trigger/sheet of ours involved) — unless
 * a test explicitly overrides `Platform.OS` to `"android"` first, see the
 * "on Android" describe block, which still covers the platform-specific
 * tap-to-open trigger/dialog design (unchanged by the fifth design).
 */
function findPickerNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onDateChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onDateChange"');
  }
  return node[0]!;
}

describe("DateTimePicker a11y", () => {
  it("reflects the selected date via the native selection prop", () => {
    const date = new Date("2026-01-15T00:00:00Z");
    const root = render(<DateTimePicker value={date} onChange={() => {}} />);
    const node = findPickerNode(root);
    expect(new Date(node.props.selection as string | number | Date).getTime()).toBe(date.getTime());
  });

  it("resolves accentColor to the design system's primary token via a tint modifier", () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} />);
    const node = findPickerNode(root);
    expect(node.props.modifiers).toContainEqual({ $type: "tint", color: "#2954E5" });
  });

  it("wires onChange through to the native date-change handler", () => {
    const onChange = jest.fn();
    const root = render(<DateTimePicker value={new Date()} onChange={onChange} />);
    const node = findPickerNode(root);
    expect(typeof node.props.onDateChange).toBe("function");
  });

  it("reports disabled via a modifier when disabled is set", () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} disabled />);
    const node = findPickerNode(root);
    expect(node.props.modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });
});

describe("DateTimePicker a11y — on Android", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("renders a tappable trigger showing the formatted value, with no dialog mounted yet", () => {
    const date = new Date("2026-01-15T00:00:00Z");
    render(<DateTimePicker value={date} onChange={() => {}} mode="date" />);
    expect(screen.getByRole("button")).toBeTruthy();
    expect(screen.getByText(date.toLocaleDateString())).toBeTruthy();
    expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
  });

  it("mounts the native dialog picker on trigger press", () => {
    const date = new Date("2026-01-15T00:00:00Z");
    render(<DateTimePicker value={date} onChange={() => {}} mode="date" />);
    fireEvent.press(screen.getByRole("button"));
    expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(1);
  });

  it("applies the selected value via onValueChange and unmounts the dialog via onDismiss", () => {
    const onChange = jest.fn();
    const date = new Date("2026-01-15T00:00:00Z");
    render(<DateTimePicker value={date} onChange={onChange} mode="date" />);
    fireEvent.press(screen.getByRole("button"));

    const dialogNode = screen.UNSAFE_getByProps({ presentation: "dialog" });
    const selected = new Date("2026-02-20T00:00:00Z");
    act(() => {
      dialogNode.props.onValueChange({ nativeEvent: { timestamp: selected.getTime(), utcOffset: 0 } }, selected);
    });
    expect(onChange).toHaveBeenCalledWith(selected);

    act(() => {
      dialogNode.props.onDismiss();
    });
    expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
  });

  it("disables the trigger when disabled is set", () => {
    render(<DateTimePicker value={new Date()} onChange={() => {}} disabled />);
    expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(true);
  });
});
