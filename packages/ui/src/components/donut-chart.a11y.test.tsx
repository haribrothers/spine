import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { DonutChart } from "./donut-chart";

const segments = [
  { key: "paid", label: "Paid", value: 4200, color: "#3d8a5f", formattedValue: "$4,200.00" },
  { key: "due-soon", label: "Due soon", value: 1800, color: "#c98a2c", formattedValue: "$1,800.00" },
  { key: "overdue", label: "Overdue", value: 900, color: "#b8433a", formattedValue: "$900.00" },
];

describe("DonutChart a11y", () => {
  it("has no violations with data", async () => {
    const { container } = render(<DonutChart segments={segments} centerLabel="$6,900.00" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with no data (empty state)", async () => {
    const { container } = render(
      <DonutChart segments={[{ key: "paid", label: "Paid", value: 0, color: "#3d8a5f", formattedValue: "$0.00" }]} />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations without its legend (the page lists the breakdown beside it)", async () => {
    const { container } = render(<DonutChart segments={segments} centerLabel="$6,900.00" legend={false} aria-label="Cost by category" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations in a narrow card, with the legend under the ring", async () => {
    const { container } = render(
      <div style={{ width: 240 }}>
        <DonutChart segments={[...segments, { key: "long", label: "61–90 days", value: 0, color: "#b8433a", formattedValue: "₹38,72,132.00" }]} centerLabel="₹44.9L" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with no center label", async () => {
    const { container } = render(<DonutChart segments={segments} />);
    await expectNoA11yViolations(container);
  });
});
