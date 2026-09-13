import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { DateTimePicker } from "./date-time-picker";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components.
 *
 * `jest-expo`'s default project (this package's only one, per
 * `jest.config.js`) resolves `Platform.OS` as `"ios"`, so every test below
 * exercises the iOS branch — the SIXTH design's `swift-ui` `DatePicker` +
 * `Host` (see this component's own doc comment for the full history) —
 * unless a test explicitly overrides `Platform.OS` to `"android"` first,
 * see the "on Android" describe block, which covers the platform-specific
 * tap-to-open trigger/dialog design, including the two-step `datetime`
 * flow that design needed (no native combined date+time dialog exists on
 * Android — see the component's doc comment for why).
 */
function findPickerNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onDateChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onDateChange"');
  }
  return node[0]!;
}

// The iOS branch's `Host` — carries `seedColor`, the SIXTH design's real
// replacement for the old per-component `tint` modifier (see this
// component's own doc comment: `Host.seedColor` applies `.tint()` to the
// whole SwiftUI subtree via `@expo/ui`'s own `SeedColorModifier`).
function findHostNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "seedColor" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "seedColor"');
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

  it("resolves accentColor to the design system's primary token via the Host's seedColor (SIXTH design — real replacement for the old per-component tint modifier)", () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} />);
    const host = findHostNode(root);
    expect(host.props.seedColor).toBe("#2954E5");
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

  it('mode="date" shows only the date component', () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} mode="date" />);
    const node = findPickerNode(root);
    expect(node.props.displayedComponents).toEqual(["date"]);
  });

  it('mode="time" shows only the time component', () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} mode="time" />);
    const node = findPickerNode(root);
    expect(node.props.displayedComponents).toEqual(["hourAndMinute"]);
  });

  it('mode="datetime" shows BOTH components in one control — a real, previously-shipped gap (see this component\'s own doc comment: an intermediate version silently dropped the time component here)', () => {
    const root = render(<DateTimePicker value={new Date()} onChange={() => {}} mode="datetime" />);
    const node = findPickerNode(root);
    expect(node.props.displayedComponents).toEqual(["date", "hourAndMinute"]);
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

  it("applies the selected value via onValueChange, which ALSO closes the dialog itself — confirmed against @expo/ui's real native source (DatePickerView.kt): onDateSelected only ever fires from inside the confirm button's onClick, never on an intermediate value change, so closing here is correct, not premature", () => {
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
    expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
  });

  it("unmounts the dialog via onDismiss when cancelled, without calling onChange", () => {
    const onChange = jest.fn();
    const date = new Date("2026-01-15T00:00:00Z");
    render(<DateTimePicker value={date} onChange={onChange} mode="date" />);
    fireEvent.press(screen.getByRole("button"));

    const dialogNode = screen.UNSAFE_getByProps({ presentation: "dialog" });
    act(() => {
      dialogNode.props.onDismiss();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
  });

  it("disables the trigger when disabled is set", () => {
    render(<DateTimePicker value={new Date()} onChange={() => {}} disabled />);
    expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(true);
  });

  describe('mode="datetime" — a real two-step flow, since Android has no native combined date+time dialog', () => {
    it("opens the DATE dialog first on trigger press, not the time dialog", () => {
      render(<DateTimePicker value={new Date("2026-01-15T09:30:00")} onChange={() => {}} mode="datetime" />);
      fireEvent.press(screen.getByRole("button"));
      const dialogs = screen.UNSAFE_queryAllByProps({ presentation: "dialog" });
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]!.props.mode).toBe("date");
    });

    it("confirming the date dialog opens the TIME dialog next, without calling onChange yet", () => {
      const onChange = jest.fn();
      render(<DateTimePicker value={new Date("2026-01-15T09:30:00")} onChange={onChange} mode="datetime" />);
      fireEvent.press(screen.getByRole("button"));

      const dateDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      const pickedDate = new Date("2026-02-20T00:00:00");
      act(() => {
        dateDialog.props.onValueChange({ nativeEvent: { timestamp: pickedDate.getTime(), utcOffset: 0 } }, pickedDate);
      });

      expect(onChange).not.toHaveBeenCalled();
      const dialogs = screen.UNSAFE_queryAllByProps({ presentation: "dialog" });
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]!.props.mode).toBe("time");
    });

    it("confirming the time dialog merges the picked date's y/m/d with the picked time's h/m into ONE Date passed to onChange", () => {
      const onChange = jest.fn();
      render(<DateTimePicker value={new Date("2026-01-15T09:30:00")} onChange={onChange} mode="datetime" />);
      fireEvent.press(screen.getByRole("button"));

      const dateDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      const pickedDate = new Date("2026-02-20T00:00:00");
      act(() => {
        dateDialog.props.onValueChange({ nativeEvent: { timestamp: pickedDate.getTime(), utcOffset: 0 } }, pickedDate);
      });

      const timeDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      const pickedTime = new Date("1970-01-01T14:45:00");
      act(() => {
        timeDialog.props.onValueChange({ nativeEvent: { timestamp: pickedTime.getTime(), utcOffset: 0 } }, pickedTime);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const merged: Date = onChange.mock.calls[0][0];
      expect(merged.getFullYear()).toBe(2026);
      expect(merged.getMonth()).toBe(1); // February
      expect(merged.getDate()).toBe(20);
      expect(merged.getHours()).toBe(14);
      expect(merged.getMinutes()).toBe(45);
      expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
    });

    it("cancelling the date dialog closes the whole flow without opening the time dialog or calling onChange", () => {
      const onChange = jest.fn();
      render(<DateTimePicker value={new Date()} onChange={onChange} mode="datetime" />);
      fireEvent.press(screen.getByRole("button"));

      const dateDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      act(() => {
        dateDialog.props.onDismiss();
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
    });

    it("cancelling the time dialog (second step) closes the whole flow without calling onChange", () => {
      const onChange = jest.fn();
      render(<DateTimePicker value={new Date()} onChange={onChange} mode="datetime" />);
      fireEvent.press(screen.getByRole("button"));

      const dateDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      const pickedDate = new Date("2026-02-20T00:00:00");
      act(() => {
        dateDialog.props.onValueChange({ nativeEvent: { timestamp: pickedDate.getTime(), utcOffset: 0 } }, pickedDate);
      });

      const timeDialog = screen.UNSAFE_getByProps({ presentation: "dialog" });
      act(() => {
        timeDialog.props.onDismiss();
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.UNSAFE_queryAllByProps({ presentation: "dialog" })).toHaveLength(0);
    });
  });
});
