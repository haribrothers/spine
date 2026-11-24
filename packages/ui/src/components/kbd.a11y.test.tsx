import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Kbd } from "./kbd";

describe("Kbd a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Kbd>⌘K</Kbd>);
    await expectNoA11yViolations(container);
  });
});
