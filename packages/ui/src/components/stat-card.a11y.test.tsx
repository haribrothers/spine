import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { StatCard } from "./stat-card";

describe("StatCard a11y", () => {
  it("has no violations without a trend", async () => {
    const { container } = render(<StatCard label="Open jobs" value="14" className="w-64" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with a detail beside the value and a warning tone (US-QUO-27)", async () => {
    const { container, getByText } = render(<StatCard label="Open" value="4" detail="₹16,82,330" className="w-64" />);
    getByText("₹16,82,330");
    await expectNoA11yViolations(container);
    const warn = render(<StatCard label="Expiring in 7 days" value="2" tone="warning" className="w-64" />);
    expect(warn.getByText("2").className).toContain("text-due-soon");
    await expectNoA11yViolations(warn.container);
  });

  it("has no violations with a critical tone (US-INV-27)", async () => {
    const { container, getByText } = render(<StatCard label="Overdue" value="$4,125.00" detail="3 invoices" tone="critical" className="w-64" />);
    expect(getByText("$4,125.00").className).toContain("text-overdue");
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
