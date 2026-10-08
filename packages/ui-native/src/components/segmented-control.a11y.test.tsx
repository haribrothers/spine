import { render } from "@testing-library/react-native";
import { SegmentedButton } from "@expo/ui/jetpack-compose";
import { SegmentedControl } from "./segmented-control";

/**
 * Same native-bridge testing adaptation as `select.a11y.test.tsx` —
 * `@expo/ui/community/segmented-control` resolves, under jest-expo, to the
 * exact same underlying `@expo/ui/swift-ui` `Picker` mock `Select` uses
 * (confirmed live via `screen.debug()`: a `pickerStyle: "segmented"`
 * modifier on the outer node, `selection`/`onSelectionChange`, and each
 * option as its own child node with `text`/a `{$type: "tag", tag}`
 * modifier — index-based here, not value-based, since the underlying
 * Picker is index-based).
 */
function findPickerNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onSelectionChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onSelectionChange"');
  }
  return node[0]!;
}

describe("SegmentedControl a11y", () => {
  it("resolves value to the matching native selection index", () => {
    const root = render(<SegmentedControl values={["This week", "This month", "This year"]} value="This month" onValueChange={() => {}} />);
    const picker = findPickerNode(root);
    expect(picker.props.selection).toBe(1);
  });

  it("passes every value through as its own native segment item, in order", () => {
    const root = render(<SegmentedControl values={["A", "B", "C"]} value="A" onValueChange={() => {}} />);
    const itemTexts = [...new Set(root.UNSAFE_root.findAll((n) => typeof n.props.text === "string").map((n) => n.props.text))];
    expect(itemTexts).toEqual(["A", "B", "C"]);
  });

  it("wires onValueChange through to the native change handler", () => {
    const onValueChange = jest.fn();
    const root = render(<SegmentedControl values={["A", "B"]} value="A" onValueChange={onValueChange} />);
    const picker = findPickerNode(root);
    expect(typeof picker.props.onSelectionChange).toBe("function");
  });

  it("uses the segmented pickerStyle modifier", () => {
    const root = render(<SegmentedControl values={["A", "B"]} value="A" onValueChange={() => {}} />);
    const picker = findPickerNode(root);
    expect(picker.props.modifiers).toContainEqual({ $type: "pickerStyle", style: "segmented" });
  });

  it("reports disabled via a modifier when disabled is set", () => {
    const root = render(<SegmentedControl values={["A", "B"]} value="A" onValueChange={() => {}} disabled />);
    const picker = findPickerNode(root);
    expect(picker.props.modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });
});

describe("SegmentedControl a11y — on Android (readable selected segment, US-MOB-20)", () => {
  const { Platform } = jest.requireActual<typeof import("react-native")>("react-native");
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = "android";
  });
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("renders one Compose segment per value, selecting the current one", () => {
    const root = render(<SegmentedControl values={["System", "Light", "Dark"]} value="Light" onValueChange={() => {}} />);
    const segments = root.UNSAFE_root.findAllByType(SegmentedButton);
    expect(segments.map((n) => n.props.selected)).toEqual([false, true, false]);
  });

  it("uses the tonal pair (info-bg behind primary text) for the selected segment", () => {
    const root = render(<SegmentedControl values={["A", "B"]} value="A" onValueChange={() => {}} />);
    const [first] = root.UNSAFE_root.findAllByType(SegmentedButton);
    expect(first!.props.colors).toMatchObject({ activeContainerColor: "#EAEFFD", activeContentColor: "#2954E5" });
  });

  it("calls onValueChange with the tapped label", () => {
    const onValueChange = jest.fn();
    const root = render(<SegmentedControl values={["A", "B"]} value="A" onValueChange={onValueChange} />);
    const segments = root.UNSAFE_root.findAllByType(SegmentedButton);
    segments[1]!.props.onClick();
    expect(onValueChange).toHaveBeenCalledWith("B");
  });
});
