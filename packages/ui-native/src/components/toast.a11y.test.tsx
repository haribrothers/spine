import { fireEvent, render, screen } from "@testing-library/react-native";
import { Toast } from "./toast";

describe("Toast a11y", () => {
  it("renders its title and description as visible text", () => {
    render(<Toast title="Invoice sent" description="INV-2026-0042 was emailed." onDismiss={() => {}} />);
    expect(screen.getByText("Invoice sent")).toBeTruthy();
    expect(screen.getByText("INV-2026-0042 was emailed.")).toBeTruthy();
  });

  it("renders with just a title — description is optional", () => {
    render(<Toast title="Saved" onDismiss={() => {}} />);
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("has an accessible, labeled dismiss button that calls onDismiss", () => {
    const onDismiss = jest.fn();
    render(<Toast title="Saved" onDismiss={onDismiss} />);
    const dismissButton = screen.getByRole("button");
    expect(dismissButton.props.accessibilityLabel).toBe("Dismiss");
    fireEvent.press(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
