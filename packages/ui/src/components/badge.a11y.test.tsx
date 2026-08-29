import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Badge } from "./badge";

describe("Badge a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Badge>Riverside Extension</Badge>);
    await expectNoA11yViolations(container);
  });
});
