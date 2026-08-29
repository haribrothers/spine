import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Spinner } from "./spinner";

describe("Spinner a11y", () => {
  it.each(["sm", "md", "lg"] as const)("has no violations (%s)", async (size) => {
    const { container } = render(<Spinner size={size} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with a custom label", async () => {
    const { container } = render(<Spinner label="Issuing invoice…" />);
    await expectNoA11yViolations(container);
  });
});
