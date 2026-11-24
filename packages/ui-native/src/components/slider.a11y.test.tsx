import { render } from "@testing-library/react-native";
import { Slider } from "./slider";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components — see `button.a11y.test.tsx`'s own doc comment. `min`/`max`/
 * `value` are plain props directly on the bridge node (confirmed live via
 * `screen.debug()`); `disabled` surfaces as a modifier, same shape as
 * Button/Switch/Select.
 */
function findSliderNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onValueChanged" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onValueChanged"');
  }
  return node[0]!;
}

describe("Slider a11y", () => {
  it("reflects value/min/max via native props", () => {
    const root = render(<Slider value={0.5} onValueChange={() => {}} min={0} max={1} />);
    const node = findSliderNode(root);
    expect(node.props.value).toBe(0.5);
    expect(node.props.min).toBe(0);
    expect(node.props.max).toBe(1);
  });

  it("wires onValueChange through to the native change handler", () => {
    const onValueChange = jest.fn();
    const root = render(<Slider value={0} onValueChange={onValueChange} />);
    const node = findSliderNode(root);
    expect(typeof node.props.onValueChanged).toBe("function");
  });

  it("reports disabled via a modifier, not just visually", () => {
    const root = render(<Slider value={0.2} onValueChange={() => {}} disabled />);
    const node = findSliderNode(root);
    expect(node.props.modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });
});
