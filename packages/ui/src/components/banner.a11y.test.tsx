import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Banner } from "./banner";

describe("Banner a11y", () => {
  it.each(["info", "warning", "critical"] as const)("has no violations (%s)", async (variant) => {
    const { container } = render(
      <Banner variant={variant} title="Spine 1.4 is available." actions={<a href="#whats-new">What's new</a>} onDismiss={() => undefined}>
        You're on 1.3. Updating takes a backup first.
      </Banner>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with no icon, title or actions", async () => {
    const { container } = render(<Banner icon={null}>Storage is 91% full.</Banner>);
    await expectNoA11yViolations(container);
  });
});
