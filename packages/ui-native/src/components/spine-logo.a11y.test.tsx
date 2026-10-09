import { render, screen } from "@testing-library/react-native";
import { SpineLogo } from "./spine-logo";

describe("SpineLogo a11y", () => {
  it("is one image read as “Spine”", () => {
    render(<SpineLogo variant="vertical" testID="logo" />);
    const logo = screen.getByLabelText("Spine");
    expect(logo.props.accessible).toBe(true);
    expect(logo.props.accessibilityRole).toBe("image");
  });

  it("is hidden from screen readers when decorative", () => {
    render(<SpineLogo variant="horizontal" decorative testID="logo" />);
    expect(screen.queryByLabelText("Spine")).toBeNull();
    const logo = screen.getByTestId("logo", { includeHiddenElements: true });
    expect(logo.props.accessibilityElementsHidden).toBe(true);
    expect(logo.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
