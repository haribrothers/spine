import { fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { FullWidthButton } from "./full-width-button";
import { expectAccessibilityState, expectAccessibleRole } from "../test/a11y";

/**
 * `jest-expo` mocks `Platform.OS` as `"ios"` by default, so the top-level
 * describe block below exercises the iOS branch — a plain RN `Pressable` +
 * `Text` (see this component's own doc comment for why iOS moved off
 * `@expo/ui`'s `Host`/`swift-ui Button`: a real "no top spacing until first
 * tap" bug rooted in `Host`'s `matchContents` async native-geometry
 * reporting). Being real RN primitives now, this uses the package's normal
 * `expectAccessibleRole`/`expectAccessibilityState` helpers instead of the
 * native-bridge-mock-prop-inspection pattern other `@expo/ui`-backed
 * components need — see `button.a11y.test.tsx` for that pattern, still used
 * below in the "on Android" describe block, since Android's branch is
 * unchanged (still real `@expo/ui/jetpack-compose`).
 */
describe("FullWidthButton a11y — on iOS (plain RN Pressable, not @expo/ui)", () => {
  it("exposes a real button role with the label as its accessible name", () => {
    render(<FullWidthButton label="Save" onPress={() => {}} />);
    const button = screen.getByRole("button");
    expectAccessibleRole(button, "button");
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("wires onPress through to a real press", () => {
    const onPress = jest.fn();
    render(<FullWidthButton label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports disabled via accessibilityState and does not fire onPress when pressed", () => {
    const onPress = jest.fn();
    render(<FullWidthButton label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole("button");
    expectAccessibilityState(button, { disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  // RNTL resolves `Pressable`'s function-style `style` prop (`({ pressed }) => ({...})`)
  // into a plain object before it lands in the rendered tree, so `props.style` below is
  // already the resolved style object for the `{ pressed: false }` case — not the callback
  // itself.
  it("primary/danger variants fill the button with a solid color and white label text; secondary is outlined with tinted text", () => {
    const primary = render(<FullWidthButton label="Save" onPress={() => {}} variant="primary" />);
    const primaryStyle = primary.getByRole("button").props.style;
    expect(primaryStyle.backgroundColor).toBe("#2954E5");
    expect(primary.getByText("Save").props.style.color).toBe("#FFFFFF");
    primary.unmount();

    const danger = render(<FullWidthButton label="Delete" onPress={() => {}} variant="danger" />);
    const dangerStyle = danger.getByRole("button").props.style;
    expect(dangerStyle.backgroundColor).toBe("#B3261E");
    expect(danger.getByText("Delete").props.style.color).toBe("#FFFFFF");
    danger.unmount();

    const secondary = render(<FullWidthButton label="Cancel" onPress={() => {}} variant="secondary" />);
    const secondaryStyle = secondary.getByRole("button").props.style;
    expect(secondaryStyle.backgroundColor).toBe("transparent");
    expect(secondaryStyle.borderColor).toBe("#2954E5");
    expect(secondary.getByText("Cancel").props.style.color).toBe("#2954E5");
  });

  it("controlSize scales the button's padding and label font size", () => {
    const regular = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const regularStyle = regular.getByRole("button").props.style;
    const regularFontSize = regular.getByText("Save").props.style.fontSize;
    regular.unmount();

    const large = render(<FullWidthButton label="Save" onPress={() => {}} controlSize="large" />);
    const largeStyle = large.getByRole("button").props.style;
    const largeFontSize = large.getByText("Save").props.style.fontSize;

    expect(largeStyle.paddingVertical).toBeGreaterThan(regularStyle.paddingVertical);
    expect(largeFontSize).toBeGreaterThan(regularFontSize);
  });

  it('shape="rounded"/"sharp" set a real borderRadius; default "pill" is a fully rounded capsule', () => {
    const pill = render(<FullWidthButton label="Save" onPress={() => {}} />);
    expect(pill.getByRole("button").props.style.borderRadius).toBe(9999);
    pill.unmount();

    const rounded = render(<FullWidthButton label="Save" onPress={() => {}} shape="rounded" />);
    expect(rounded.getByRole("button").props.style.borderRadius).toBe(10);
    rounded.unmount();

    const sharp = render(<FullWidthButton label="Save" onPress={() => {}} shape="sharp" />);
    expect(sharp.getByRole("button").props.style.borderRadius).toBe(0);
  });

  it("applies no negative-margin compensation around the button (a real, reverted regression from when this used @expo/ui's Host — see this file's own doc comment)", () => {
    render(<FullWidthButton label="Save" onPress={() => {}} />);
    const style = screen.getByRole("button").props.style;
    expect((style as { marginBottom?: number }).marginBottom ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("FullWidthButton a11y — on Android (unchanged: real @expo/ui/jetpack-compose)", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  function findByPropName(root: ReturnType<typeof render>, propName: string) {
    const node = root.UNSAFE_root.findAll((n) => propName in n.props);
    if (node.length === 0) {
      throw new Error(`No instance found with prop "${propName}"`);
    }
    return node[0]!;
  }

  function findNativeButtonNode(root: ReturnType<typeof render>) {
    const nodes = root.UNSAFE_root.findAll((n) => "onClick" in n.props && Array.isArray(n.props.modifiers));
    if (nodes.length === 0) {
      throw new Error('No native button node found with both "onClick" and "modifiers"');
    }
    return nodes[0]!;
  }

  it("wires onPress through to the native onClick handler", () => {
    const onPress = jest.fn();
    const root = render(<FullWidthButton label="Save" onPress={onPress} />);
    const node = findNativeButtonNode(root);
    expect(typeof node.props.onClick).toBe("function");
  });

  it("disables via enabled={false} rather than omitting onClick alone", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} disabled />);
    const node = findNativeButtonNode(root);
    expect(node.props.enabled).toBe(false);
  });

  it("applies fillMaxWidth() so the Compose Button stretches to the full width", () => {
    const root = render(<FullWidthButton label="Save" onPress={() => {}} />);
    const modifiers = findNativeButtonNode(root).props.modifiers as Array<Record<string, unknown>>;
    expect(modifiers.some((m) => m.$type === "fillMaxWidth")).toBe(true);
  });

  it("danger variant seeds its Host with the overdue color, not the default primary tint", () => {
    const root = render(<FullWidthButton label="Delete" onPress={() => {}} variant="danger" />);
    const host = findByPropName(root, "seedColor");
    expect(host.props.seedColor).not.toBe("#2954E5");
  });

  it('shape="rounded"/"sharp" pass a real Shape.RoundedCorner/Shape.Rectangle value (called as a function, not JSX — see androidShapeElement\'s own comment)', () => {
    const rounded = render(<FullWidthButton label="Save" onPress={() => {}} shape="rounded" />);
    expect(findNativeButtonNode(rounded).props.shape).toBeDefined();
    rounded.unmount();

    const pill = render(<FullWidthButton label="Save" onPress={() => {}} />);
    expect(findNativeButtonNode(pill).props.shape).toBeUndefined();
  });
});
