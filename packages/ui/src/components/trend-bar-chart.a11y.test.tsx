import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { TrendBarChart, type TrendBarChartPoint } from "./trend-bar-chart";

const monthly: TrendBarChartPoint[] = [
  { key: "2026-06", label: "Jun", value: 42000, formattedValue: "$42,000.00" },
  { key: "2026-07", label: "Jul", value: 51500, formattedValue: "$51,500.00" },
  { key: "2026-08", label: "Aug", value: 38900, formattedValue: "$38,900.00" },
];

const byStage: TrendBarChartPoint[] = [
  { key: "quoted", label: "Quoted", value: 6, formattedValue: "6" },
  { key: "won", label: "Won", value: 3, formattedValue: "3" },
];

describe("TrendBarChart a11y", () => {
  it("has no violations (vertical, revenue trend)", async () => {
    const { container } = render(<TrendBarChart data={monthly} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations (horizontal, pipeline by stage)", async () => {
    const { container } = render(<TrendBarChart data={byStage} orientation="horizontal" />);
    await expectNoA11yViolations(container);
  });

  it("has no violations in the empty state", async () => {
    const { container } = render(
      <TrendBarChart data={[{ key: "2026-08", label: "Aug", value: 0, formattedValue: "$0.00" }]} />,
    );
    await expectNoA11yViolations(container);
  });
});
