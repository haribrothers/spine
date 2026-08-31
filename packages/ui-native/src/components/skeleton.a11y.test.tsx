import { render } from "@testing-library/react-native";
import { Skeleton } from "./skeleton";

describe("Skeleton a11y", () => {
  it("renders without an accessibility role or label — a screen reader should skip it, not announce anything meaningless", () => {
    const { toJSON } = render(<Skeleton className="h-4 w-32" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const node = Array.isArray(tree) ? tree[0] : tree;
    expect(node?.props.accessibilityRole).toBeUndefined();
    expect(node?.props.accessibilityLabel).toBeUndefined();
  });
});
