import { render } from "@testing-library/react-native";
import { ScrollEdgeMask } from "./scroll-edge-mask";

/**
 * `ScrollEdgeMask` is a purely decorative overlay with no interactive
 * semantics of its own — its one real accessibility-relevant property is
 * `pointerEvents="none"`, which must always hold: a fade mask that
 * accidentally captures touches would silently block taps on whatever
 * content scrolls underneath it (the exact class of bug `FloatingTabBar`'s
 * own past `pointerEvents="box-none"` fix addressed for a similar
 * floating-over-content layer).
 */
describe("ScrollEdgeMask a11y", () => {
  it("never intercepts touches, for either edge", () => {
    for (const edge of ["top", "bottom"] as const) {
      const { toJSON, unmount } = render(<ScrollEdgeMask edge={edge} />);
      const root = toJSON();
      const node = Array.isArray(root) ? root[0] : root;
      expect(node?.props.pointerEvents).toBe("none");
      unmount();
    }
  });

  it("pins to the requested edge", () => {
    const { toJSON, unmount } = render(<ScrollEdgeMask edge="top" />);
    const root = toJSON();
    const node = Array.isArray(root) ? root[0] : root;
    const style = ([] as object[]).concat(node?.props.style ?? []);
    expect(style.some((s) => "top" in s && (s as { top: number }).top === 0)).toBe(true);
    unmount();
  });
});
