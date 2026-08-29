import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { StatCard } from "./stat-card";

describe("StatCard a11y", () => {
  it("has no violations without a trend", async () => {
    const { container } = render(<StatCard label="Open jobs" value="14" className="w-64" />);
    await expectNoA11yViolations(container);
  });

  it.each(["up", "down", "neutral"] as const)("has no violations with a %s trend", async (direction) => {
    const { container } = render(
      <StatCard
        label="Cash position"
        value="$48,210"
        trend={{ direction, label: direction === "up" ? "+12% vs last month" : direction === "down" ? "-4% vs last month" : "No change" }}
        className="w-64"
      />,
    );
    await expectNoA11yViolations(container);
  });
});
