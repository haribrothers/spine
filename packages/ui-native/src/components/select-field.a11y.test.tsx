import { render, screen } from "@testing-library/react-native";
import { SelectField } from "./select-field";

const OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
];

/**
 * Same native-bridge testing adaptation as `ContextMenu`'s own a11y test,
 * with one difference: `SelectField` passes `state: "on"|"off"` on every
 * action (so the currently-selected option shows a checkmark), which makes
 * `@expo/ui`'s `MenuView` render each item as a `Toggle` node
 * (`isOn`/`onIsOnChange` props), not a `Button` node (`onButtonPress`) —
 * confirmed live via `screen.debug()`. `onPressAction` still fires the same
 * way regardless of which native node type renders the item, so this
 * lookup targets `onIsOnChange` instead of `ContextMenu`'s `onButtonPress`.
 */
function findActionNodes(root: ReturnType<typeof render>) {
  const nodes = root.UNSAFE_root.findAll((n) => "onIsOnChange" in n.props && (n.type as unknown) === "ViewManagerAdapter_ExpoUI");
  return [...new Set(nodes.map((n) => n.props.label))].map((label) => nodes.find((n) => n.props.label === label)!);
}

describe("SelectField a11y", () => {
  it("shows the selected option's label", () => {
    render(<SelectField options={OPTIONS} value="in_progress" onValueChange={() => {}} />);
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  it("shows the placeholder when no option matches the current value", () => {
    render(<SelectField options={OPTIONS} value="" onValueChange={() => {}} placeholder="Select…" />);
    expect(screen.getByText("Select…")).toBeTruthy();
  });

  it("passes every option through as a menu action with its label", () => {
    const root = render(<SelectField options={OPTIONS} value="not_started" onValueChange={() => {}} />);
    const labels = findActionNodes(root).map((n) => n.props.label);
    expect(labels).toEqual(["Not started", "In progress"]);
  });

  it("marks only the currently-selected option's action as on", () => {
    const root = render(<SelectField options={OPTIONS} value="not_started" onValueChange={() => {}} />);
    const [notStartedNode, inProgressNode] = findActionNodes(root);
    expect(notStartedNode!.props.isOn).toBe(true);
    expect(inProgressNode!.props.isOn).toBe(false);
  });

  it("wires a selected action's press through to onValueChange with its value", () => {
    const onValueChange = jest.fn();
    const root = render(<SelectField options={OPTIONS} value="not_started" onValueChange={onValueChange} />);
    const [, inProgressNode] = findActionNodes(root);
    (inProgressNode!.props.onIsOnChange as (event: { nativeEvent: { isOn: boolean } }) => void)({ nativeEvent: { isOn: true } });
    expect(onValueChange).toHaveBeenCalledWith("in_progress");
  });

  it("renders no menu (a static, non-interactive trigger) when disabled", () => {
    const root = render(<SelectField options={OPTIONS} value="not_started" onValueChange={() => {}} disabled />);
    expect(findActionNodes(root)).toHaveLength(0);
  });
});
