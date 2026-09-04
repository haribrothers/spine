import { render } from "@testing-library/react-native";
import { Select } from "./select";

const STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "In progress", value: "in_progress" },
  { label: "Complete", value: "complete" },
];

/**
 * Same native-bridge testing adaptation as `button.a11y.test.tsx`/
 * `switch.a11y.test.tsx` — `@expo/ui`'s `Picker` renders as
 * `ViewManagerAdapter_ExpoUI` mocks under jest-expo with no RNTL-queryable
 * role. The outer node carries `selection`/`onSelectionChange` directly and
 * a `disabled` modifier for `enabled={false}` (confirmed live via
 * `screen.debug()`); each `Picker.Item` renders as its own node with
 * `text` (the label) and a `{$type: "tag", tag: value}` modifier carrying
 * the value.
 */
function findPickerNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onSelectionChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onSelectionChange"');
  }
  return node[0]!;
}

describe("Select a11y", () => {
  it("reflects the selected value via the native selection prop", () => {
    const root = render(<Select options={STATUS_OPTIONS} value="in_progress" onValueChange={() => {}} />);
    const picker = findPickerNode(root);
    expect(picker.props.selection).toBe("in_progress");
  });

  it("passes every option through as its own native item, label and value included", () => {
    const root = render(<Select options={STATUS_OPTIONS} value="scheduled" onValueChange={() => {}} />);
    const itemTexts = [...new Set(root.UNSAFE_root.findAll((n) => typeof n.props.text === "string").map((n) => n.props.text))];
    expect(itemTexts).toEqual(["Scheduled", "In progress", "Complete"]);

    const itemTags = [
      ...new Set(
        root.UNSAFE_root
          .findAll((n) => Array.isArray(n.props.modifiers) && n.props.modifiers.some((m: { $type?: string }) => m.$type === "tag"))
          .map((n) => n.props.modifiers.find((m: { $type: string; tag: string }) => m.$type === "tag").tag),
      ),
    ];
    expect(itemTags).toEqual(["scheduled", "in_progress", "complete"]);
  });

  it("reports disabled via a modifier when enabled=false", () => {
    const root = render(<Select options={STATUS_OPTIONS} value="complete" onValueChange={() => {}} enabled={false} />);
    const picker = findPickerNode(root);
    expect(picker.props.modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });
});
