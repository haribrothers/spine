import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { PageLoader } from "./page-loader";

describe("PageLoader a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<PageLoader label="Loading jobs" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations full screen", async () => {
    const { container } = render(<PageLoader label="Loading jobs" fullScreen />);
    await expectNoA11yViolations(container);
  });
});
