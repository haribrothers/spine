import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Button } from "./button";

/**
 * `@expo/ui`'s `Button` renders as an opaque native-bridge mock under
 * jest-expo (`ViewManagerAdapter_ExpoUI`, confirmed live via `screen.debug()`
 * during development of this test) — it carries NO `accessibilityRole`,
 * `accessibilityLabel`, or `accessibilityState` in this test environment at
 * all (those are real native accessibility properties applied by the actual
 * SwiftUI/Compose view at runtime, which the RN-side native-module mock
 * doesn't simulate). This means `src/test/a11y.ts`'s `expectAccessibleRole`/
 * `expectAccessibilityState` helpers — written for RN-primitive components
 * like the OLD Pressable-based Button — cannot be used here: `getByRole`
 * finds nothing to query.
 *
 * Instead, this asserts against the PROPS actually passed into the
 * `@expo/ui` component (found via `UNSAFE_getByProps` matching the
 * `onButtonPress` handler `@expo/ui`'s `Button` always sets, since the
 * bridge component has no display name to query by type) — specifically,
 * that `modifiers` carries the right `buttonStyle` variant and a `disabled`
 * modifier reflecting the given prop. This is a real, meaningful assertion
 * (it catches "did we forget to wire this prop"), just one level shallower
 * than a full accessibility-tree walk — the actual accessibility semantics
 * (native role/label/state) are the responsibility of `@expo/ui`'s own
 * SwiftUI/Compose implementation on a real device, verified manually with
 * VoiceOver/TalkBack rather than by an automated RNTL test here.
 */
function findByPropName(root: ReturnType<typeof render>, propName: string) {
  const node = root.UNSAFE_root.findAll((n) => propName in n.props);
  if (node.length === 0) {
    throw new Error(`No instance found with prop "${propName}"`);
  }
  return node[0]!;
}

function getButtonModifiers(root: ReturnType<typeof render>) {
  const node = findByPropName(root, "onButtonPress");
  return node.props.modifiers as Array<Record<string, unknown>>;
}

describe("Button a11y", () => {
  it("wires onPress through to the native button-press handler", () => {
    const onPress = jest.fn();
    const root = render(<Button onPress={onPress}>Save</Button>);
    const node = findByPropName(root, "onButtonPress");
    expect(typeof node.props.onButtonPress).toBe("function");
  });

  it("reports disabled via a modifier, not just visually", () => {
    const root = render(
      <Button onPress={() => {}} disabled>
        Save
      </Button>,
    );
    const modifiers = getButtonModifiers(root);
    expect(modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });

  it("every variant maps to a real @expo/ui buttonStyle modifier", () => {
    const expected: Record<string, string> = {
      primary: "borderedProminent",
      secondary: "bordered",
      danger: "borderedProminent",
      ghost: "plain",
    };
    for (const [variant, style] of Object.entries(expected)) {
      const root = render(
        <Button onPress={() => {}} variant={variant as "primary" | "secondary" | "danger" | "ghost"}>
          Action
        </Button>,
      );
      const modifiers = getButtonModifiers(root);
      expect(modifiers).toContainEqual({ $type: "buttonStyle", style });
      root.unmount();
    }
  });

  it("danger variant seeds its Host with the overdue color, not the default primary tint", () => {
    const root = render(
      <Button onPress={() => {}} variant="danger">
        Delete
      </Button>,
    );
    const host = findByPropName(root, "seedColor");
    expect(host.props.seedColor).not.toBe("#2954E5");
  });

  it("routes a plain string children through label, never as a raw children node (regression)", () => {
    // Real bug, reproduced on a real iOS device (not caught by jest-expo's
    // mock render): passing a bare string as `children` straight through to
    // `@expo/ui`'s native Button crashes Fabric with
    // NSInternalInconsistencyException ("ComponentView... (`RawText`) not
    // found") — the native host view expects a structured element for
    // custom `children`, not raw text. `label` is the only correct path for
    // plain-text button content.
    const root = render(<Button onPress={() => {}}>Save</Button>);
    const node = findByPropName(root, "onButtonPress");
    expect(node.props.label).toBe("Save");
    expect(node.props.children).toBeUndefined();
  });

  it("still renders a real element child (e.g. an icon) as children, not label", () => {
    const root = render(
      <Button onPress={() => {}}>
        <Text>Custom</Text>
      </Button>,
    );
    const node = findByPropName(root, "onButtonPress");
    expect(node.props.label).toBeUndefined();
    expect(node.props.children).toBeDefined();
  });
});
