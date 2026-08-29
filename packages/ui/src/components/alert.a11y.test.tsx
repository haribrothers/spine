import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert a11y", () => {
  it.each(["info", "warning", "critical", "success"] as const)("has no violations (%s)", async (variant) => {
    const { container } = render(
      <Alert variant={variant}>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something you should know.</AlertDescription>
      </Alert>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with no icon", async () => {
    const { container } = render(
      <Alert variant="info" icon={null}>
        <AlertDescription>No icon here.</AlertDescription>
      </Alert>,
    );
    await expectNoA11yViolations(container);
  });
});
