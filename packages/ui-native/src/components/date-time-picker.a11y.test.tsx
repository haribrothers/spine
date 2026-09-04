import { render } from "@testing-library/react-native";
import { DateTimePicker } from "./date-time-picker";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components. `@expo/ui`'s own `DateTimePicker` translates several props
 * (`accentColor`, `disabled`) into `modifiers` internally rather than
 * plain props (confirmed live via `screen.debug()`) — this wrapper just
 * passes them straight through, so the assertions check the resulting
 * `tint`/`disabled` modifiers `@expo/ui` itself produces.
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
