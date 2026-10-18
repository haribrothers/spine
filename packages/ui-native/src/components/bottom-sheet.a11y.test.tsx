import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { BottomSheet } from "./bottom-sheet";

/**
 * Same native-bridge testing adaptation as the other `@expo/ui`-backed
 * components — `isPresented`/`onDismiss` are real props on the outer
 * bridge node; `showDragIndicator`/`containerColor` surface as
 * `presentationDragIndicator`/`presentationBackground` modifiers on the
 * inner content node (confirmed live via `screen.debug()`). `children`
 * render as an ordinary RN tree, so `getByText` works directly.
 */
function findSheetNode(root: ReturnType<typeof render>) {
  const node = root.UNSAFE_root.findAll((n) => "onIsPresentedChange" in n.props);
  if (node.length === 0) {
    throw new Error('No instance found with prop "onIsPresentedChange"');
  }
  return node[0]!;
}

function findContentModifiers(root: ReturnType<typeof render>) {
  const nodes = root.UNSAFE_root.findAll(
    (n) => Array.isArray(n.props.modifiers) && n.props.modifiers.some((m: { $type?: string }) => m.$type === "presentationBackground"),
  );
  return nodes[0]!.props.modifiers as Array<Record<string, unknown>>;
}

describe("BottomSheet a11y", () => {
  it("renders its content as an ordinary, queryable element when presented", () => {
    render(
      <BottomSheet isPresented onDismiss={() => {}}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );
    expect(screen.getByText("Sheet content")).toBeTruthy();
  });

  it("reflects isPresented via the native prop", () => {
    const root = render(<BottomSheet isPresented={false} onDismiss={() => {}} />);
    const node = findSheetNode(root);
    expect(node.props.isPresented).toBe(false);
  });

  it("wires onDismiss through to the native dismiss handler", () => {
    const onDismiss = jest.fn();
    const root = render(<BottomSheet isPresented onDismiss={onDismiss} />);
    const node = root.UNSAFE_root.findAll((n) => typeof n.props.onDismiss === "function")[0]!;
    expect(typeof node.props.onDismiss).toBe("function");
  });

  it("themes its own chrome background from the design system's surface token", () => {
    const root = render(<BottomSheet isPresented onDismiss={() => {}} />);
    const modifiers = findContentModifiers(root);
    // @expo/ui 57.0.25 paints the sheet with any ShapeStyle: the color arrives as `style`.
    expect(modifiers).toContainEqual({ $type: "presentationBackground", style: { type: "color", color: "#FFFFFF" } });
  });

  it("shows the drag indicator by default", () => {
    const root = render(<BottomSheet isPresented onDismiss={() => {}} />);
    const modifiers = findContentModifiers(root);
    expect(modifiers).toContainEqual({ $type: "presentationDragIndicator", visibility: "visible" });
  });

  // See this file's own doc comment: `matchContents` must track whether
  // `snapPoints` is set, or a fixed-height sheet's content (e.g.
  // `SelectListField`'s search box + list) collapses to its own intrinsic
  // width instead of filling the sheet — a real, reported bug.
  function findRNHostViewNode(root: ReturnType<typeof render>) {
    const nodes = root.UNSAFE_root.findAll((n) => "matchContents" in n.props);
    if (nodes.length === 0) {
      throw new Error('No instance found with prop "matchContents"');
    }
    return nodes[0]!;
  }

  it("matchContents is true (size-to-content) when no snapPoints are given — the genuine dynamic-sizing case", () => {
    const root = render(<BottomSheet isPresented onDismiss={() => {}} />);
    expect(findRNHostViewNode(root).props.matchContents).toBe(true);
  });

  it("matchContents is false (fill the sheet) when real snapPoints are given — a fixed-height sheet like SelectListField's", () => {
    const root = render(<BottomSheet isPresented onDismiss={() => {}} snapPoints={[{ fraction: 0.75 }]} />);
    expect(findRNHostViewNode(root).props.matchContents).toBe(false);
  });
});
