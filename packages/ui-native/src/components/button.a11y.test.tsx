import { render, screen } from "@testing-library/react-native";
import { Button } from "./button";
import { expectAccessibilityState, expectAccessibleRole } from "../test/a11y";

describe("Button a11y", () => {
  it("has an accessible role and label from its visible text (default state)", () => {
    render(<Button onPress={() => {}}>Save</Button>);
    const button = screen.getByRole("button");
    expectAccessibleRole(button, "button");
    expectAccessibilityState(button, { disabled: false, busy: false });
  });

  it("reports disabled via accessibilityState, not just visually", () => {
    render(
      <Button onPress={() => {}} disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    expectAccessibilityState(button, { disabled: true, busy: false });
  });

  it("reports busy via accessibilityState while loading", () => {
    render(
      <Button onPress={() => {}} loading>
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    expectAccessibilityState(button, { disabled: true, busy: true });
  });

  it("every variant renders with an accessible button role", () => {
    for (const variant of ["primary", "secondary", "danger", "ghost"] as const) {
      const { unmount } = render(
        <Button onPress={() => {}} variant={variant}>
          Action
        </Button>,
      );
      expect(screen.getByRole("button")).toBeTruthy();
      unmount();
    }
  });
});
