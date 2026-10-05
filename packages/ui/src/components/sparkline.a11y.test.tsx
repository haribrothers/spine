import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Sparkline } from "./sparkline";

describe("Sparkline a11y", () => {
  it.each(["positive", "negative", "neutral"] as const)("has no violations (tone=%s)", async (tone) => {
    const { container } = render(
      <p>
        Cash position $12,024.75 <Sparkline values={[9800, 10200, 9900, 11050, 11300, 10900, 11800, 12024]} tone={tone} />
      </p>,
    );
    await expectNoA11yViolations(container);
  });

  it("is hidden from screen readers, even with one point", async () => {
    const { container } = render(<Sparkline values={[0]} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await expectNoA11yViolations(container);
  });
});
