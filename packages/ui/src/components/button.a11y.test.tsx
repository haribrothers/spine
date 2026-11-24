import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";

describe("Button a11y", () => {
  it.each(["primary", "secondary", "danger", "ghost"] as const)("has no violations (%s)", async (variant) => {
    const { container } = render(<Button variant={variant}>Save</Button>);
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(<Button disabled>Save</Button>);
    await expectNoA11yViolations(container);
  });

  it("has no violations as an icon-only button with aria-label", async () => {
    const { container } = render(
      <Button size="icon" aria-label="Close">
        ×
      </Button>,
    );
    await expectNoA11yViolations(container);
  });
});
