import { AccessibilityInfo } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { Skeleton } from "./skeleton";

describe("Skeleton a11y", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is hidden from screen readers — the loading section announces itself, not each block", () => {
    const { toJSON } = render(<Skeleton className="h-4 w-32" />);
    const tree = toJSON();
    const node = Array.isArray(tree) ? tree[0] : tree;
    expect(node?.props.accessibilityRole).toBeUndefined();
    expect(node?.props.accessibilityLabel).toBeUndefined();
    expect(node?.props.accessibilityElementsHidden).toBe(true);
    expect(node?.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("holds still when Reduce Motion is on", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { toJSON } = render(<Skeleton className="h-4 w-32" />);
    await waitFor(() => {
      const tree = toJSON();
      const node = Array.isArray(tree) ? tree[0] : tree;
      expect(node?.props.style).toEqual(expect.objectContaining({ opacity: 0.75 }));
    });
  });
});
