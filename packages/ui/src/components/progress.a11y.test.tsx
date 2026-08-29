import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Progress } from "./progress";

describe("Progress a11y", () => {
  it.each([0, 42, 72, 100])("has no violations (value=%i)", async (value) => {
    const { container } = render(
      <Progress value={value} aria-label="Job cost vs budget" className="w-64" />,
    );
    await expectNoA11yViolations(container);
  });
});
