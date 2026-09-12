import { render } from "@testing-library/react-native";
import { Divider } from "./divider";

describe("Divider a11y", () => {
  it("is hidden from assistive technology as purely decorative", () => {
    const { toJSON } = render(<Divider testID="divider" />);
    const node = toJSON() as { props: Record<string, unknown> };
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe("no");
  });
});
