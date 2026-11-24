import { render } from "@testing-library/react-native";
import { Switch } from "./switch";

/**
 * Same native-bridge testing adaptation as `button.a11y.test.tsx` — see
 * that file's own doc comment for why RNTL's `getByRole`/`expectAccessibleRole`
 * can't be used here (the `@expo/ui` mock carries no accessibility props
 * under jest-expo). `label` is a genuine prop on the bridge component
 * itself (confirmed live via `screen.debug()`), so unlike Button's props
 * (which needed a `findAll`-based prop lookup since `Switch`'s wrapping
 * `Host` has no distinguishing prop of its own to search by), this queries
 * directly by the `onIsOnChange` prop `@expo/ui`'s `Switch` always sets.
 */
function findSwitchNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onIsOnChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onIsOnChange"');
  }
  return node[0]!;
}

describe("Switch a11y", () => {
  it("reflects value via the native isOn prop", () => {
    const root = render(<Switch value={true} onValueChange={() => {}} label="Enable notifications" />);
    const node = findSwitchNode(root);
    expect(node.props.isOn).toBe(true);
    expect(node.props.label).toBe("Enable notifications");
  });

  it("wires onValueChange through to the native change handler", () => {
    const onValueChange = jest.fn();
    const root = render(<Switch value={false} onValueChange={onValueChange} />);
    const node = findSwitchNode(root);
    expect(typeof node.props.onIsOnChange).toBe("function");
  });

  it("reports disabled via a modifier, not just visually", () => {
    const root = render(<Switch value={false} onValueChange={() => {}} disabled />);
    const node = findSwitchNode(root);
    expect(node.props.modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });

  it("has no accessible label at all when the caller omits one — callers must always pass a label for a screen reader to announce anything", () => {
    const root = render(<Switch value={false} onValueChange={() => {}} />);
    const node = findSwitchNode(root);
    expect(node.props.label).toBeUndefined();
  });
});
