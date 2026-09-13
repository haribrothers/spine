import { render } from "@testing-library/react-native";
import { FullWidthButton } from "./full-width-button";

/**
 * Same native-bridge testing adaptation as `button.a11y.test.tsx` — see
 * that file's own doc comment for the full rationale (`@expo/ui` renders
 * as an opaque native-bridge mock under jest-expo with no real
 * accessibility tree, so assertions target the props actually passed into
 * the native component instead).
 *
 * `jest-expo` mocks `Platform.OS` as `"ios"`, so these tests exercise the
 * `swift-ui/Button` + `swift-ui/Text` branch — the actual fix this
 * component exists for (see its own doc comment for why `Button` itself
 * can't do this). The Android branch (`fillMaxWidth()` applied directly to
 * a Jetpack Compose `Button`) has no equivalent content-vs-background
 * sizing problem to test for; it's verified by reading Compose's own
 * modifier-driven sizing model plus on-device confirmation, same as this
 * package's other Android-specific `@expo/ui` branches.
 */
function findByPropName(root: ReturnType<typeof render>, propName: string) {
  const node = root.UNSAFE_root.findAll((n) => propName in n.props);
  if (node.length === 0) {
    throw new Error(`No instance found with prop "${propName}"`);
  }
  return node[0]!;
}

// `onPress` alone matches this component's own outer composite JSX element
// (which just forwards `label`/`disabled` as authored, with no `modifiers`
// array at all) before it reaches the actual native-bridge mock node —
// this finds the one that also carries a real `modifiers` array.
function findNativeButtonNode(root: ReturnType<typeof render>) {
  const nodes = root.UNSAFE_root.findAll((n) => "onPress" in n.props && Array.isArray(n.props.modifiers));
  if (nodes.length === 0) {
    throw new Error('No native button node found with both "onPress" and "modifiers"');
  }
  return nodes[0]!;
}

describe("FullWidthButton a11y", () => {
  it("wires onPress through to the native button-press handler", () => {
    const onPress = jest.fn();
    const root = render(<FullWidthButton label="Save" onPress={onPress} />);
    const node = findByPropName(root, "onPress");
    expect(typeof node.props.onPress).toBe("function");
  });

  it("reports disabled via a modifier on the Button itself, not just visually", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} disabled />);
    const node = findNativeButtonNode(root);
    const modifiers = node.props.modifiers as Array<Record<string, unknown>>;
    expect(modifiers).toContainEqual({ $type: "disabled", disabled: true });
  });

  it("every variant maps to a real @expo/ui buttonStyle modifier on the Button itself", () => {
    const expected: Record<string, string> = {
      primary: "borderedProminent",
      secondary: "bordered",
      danger: "borderedProminent",
    };
    for (const [variant, style] of Object.entries(expected)) {
      const root = render(<FullWidthButton label="Action" onPress={() => {}} variant={variant as "primary" | "secondary" | "danger"} />);
      const node = findNativeButtonNode(root);
      const modifiers = node.props.modifiers as Array<Record<string, unknown>>;
      expect(modifiers).toContainEqual({ $type: "buttonStyle", style });
      root.unmount();
    }
  });

  it("danger variant seeds its Host with the overdue color, not the default primary tint", () => {
    const root = render(<FullWidthButton label="Delete" onPress={() => {}} variant="danger" />);
    const host = findByPropName(root, "seedColor");
    expect(host.props.seedColor).not.toBe("#2954E5");
  });

  it("puts the full-width frame modifier on the LABEL content, not on the Button itself (the actual fix this component exists for)", () => {
    // Button.tsx's own doc comment: an outer frame on the Button view constrains
    // only the invisible layout box, not the visually-painted pill — the fix is
    // sizing the label content itself, which SwiftUI's buttonStyle then wraps.
    const root = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const buttonNode = findNativeButtonNode(root);
    const buttonModifiers = buttonNode.props.modifiers as Array<Record<string, unknown>>;
    expect(buttonModifiers.find((m) => m.$type === "frame")).toBeUndefined();

    const textNode = root.UNSAFE_root.findAll((n) => Array.isArray(n.props.modifiers) && n.props.children === "Save")[0];
    const textModifiers = textNode!.props.modifiers as Array<Record<string, unknown>>;
    const frameModifier = textModifiers.find((m) => m.$type === "frame");
    expect(frameModifier).toBeDefined();
    expect(typeof frameModifier!.maxWidth).toBe("number");
    expect(Number.isFinite(frameModifier!.maxWidth)).toBe(true);
  });

  it("controlSize adds a real SwiftUI controlSize modifier on the Button itself", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} controlSize="large" />);
    const modifiers = findNativeButtonNode(root).props.modifiers as Array<Record<string, unknown>>;
    expect(modifiers).toContainEqual({ $type: "controlSize", size: "large" });
  });

  it("omits the controlSize modifier entirely when not set (default)", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const modifiers = findNativeButtonNode(root).props.modifiers as Array<Record<string, unknown>>;
    expect(modifiers.find((m) => m.$type === "controlSize")).toBeUndefined();
  });

  it('shape="rounded"/"sharp" add a real buttonBorderShape modifier on iOS — this is the SAME real mechanism as Button\'s own shape prop, confirmed working (distinct from the earlier, failed clipShape attempt)', () => {
    const rounded = render(<FullWidthButton label="Save" onPress={() => {}} shape="rounded" />);
    const roundedModifiers = findNativeButtonNode(rounded).props.modifiers as Array<Record<string, unknown>>;
    expect(roundedModifiers).toContainEqual({ $type: "buttonBorderShape", shape: "roundedRectangle", cornerRadius: 10 });

    const sharp = render(<FullWidthButton label="Save" onPress={() => {}} shape="sharp" />);
    const sharpModifiers = findNativeButtonNode(sharp).props.modifiers as Array<Record<string, unknown>>;
    expect(sharpModifiers).toContainEqual({ $type: "buttonBorderShape", shape: "roundedRectangle", cornerRadius: 0 });
  });

  it('shape defaults to "pill" (no buttonBorderShape modifier at all)', () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const modifiers = findNativeButtonNode(root).props.modifiers as Array<Record<string, unknown>>;
    expect(modifiers.find((m) => m.$type === "buttonBorderShape")).toBeUndefined();
  });

  it("applies no negative-margin compensation around the Host (a real, reverted regression — see this file's own doc comment: an earlier fixed-margin attempt overlapped adjacent buttons on a real device)", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const negativeMarginNode = root.UNSAFE_root.findAll(
      (n) => n.props.style && typeof n.props.style === "object" && (n.props.style as { marginBottom?: number }).marginBottom! < 0,
    );
    expect(negativeMarginNode).toHaveLength(0);
  });
});
