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

  it("disabled label text isn't left invisible by a variant/disabled class collision (regression)", () => {
    // Real bug: without tailwind-merge dedupe, a variant's own text color
    // (e.g. primary's text-white) and the disabled override
    // (text-on-surface-muted) are both same-specificity NativeWind
    // classes — which one visually won depended on Tailwind's build-time
    // CSS-discovery order, not on cva/className order, and on web this
    // rendered white text on a transparent disabled background (invisible).
    // cn()'s tailwind-merge dedupe must always leave exactly the disabled
    // color, never the variant's own, for every variant.
    for (const variant of ["primary", "secondary", "danger", "ghost"] as const) {
      const { unmount } = render(
        <Button onPress={() => {}} variant={variant} disabled>
          Action
        </Button>,
      );
      const label = screen.getByText("Action");
      const flatClassName = ([] as string[]).concat(label.props.className ?? []).join(" ");
      expect(flatClassName).toContain("text-on-surface-muted");
      expect(flatClassName).not.toMatch(/\btext-white\b/);
      unmount();
    }
  });
});
