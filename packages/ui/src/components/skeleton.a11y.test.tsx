import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Skeleton } from "./skeleton";

describe("Skeleton a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    await expectNoA11yViolations(container);
  });
});
