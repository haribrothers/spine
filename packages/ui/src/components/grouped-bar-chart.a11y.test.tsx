import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { GroupedBarChart, type GroupedBarChartRow } from "./grouped-bar-chart";

const series = [
  { key: "contract", label: "Contract value", color: "var(--color-on-surface-muted)" },
  { key: "billed", label: "Billed to date", color: "var(--color-primary)" },
  { key: "cost", label: "Cost", color: "var(--color-due-soon)" },
];

const data: GroupedBarChartRow[] = [
  { key: "a", label: "Marina office fit-out", contract: 48500, billed: 19400, cost: 24800, budget: 32000 },
  { key: "b", label: "Hotel lobby renovation", contract: 21000, billed: 0, cost: 0, budget: null },
];

const props = {
  series,
  formatTick: (v: number) => `$${Math.round(v / 1000)}k`,
  renderTooltip: (row: GroupedBarChartRow) => row.label,
  "aria-label": "Contract, billed and cost by job",
  description: "The table below lists every job.",
};

describe("GroupedBarChart a11y", () => {
  it("has no violations with a budget marker", async () => {
    const { container } = render(<GroupedBarChart {...props} data={data} marker={{ key: "budget", label: "Cost budget", seriesKey: "cost" }} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations without a marker", async () => {
    const { container } = render(<GroupedBarChart {...props} data={data} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations in the empty state", async () => {
    const { container } = render(<GroupedBarChart {...props} data={[]} emptyState="No jobs to chart." />);
    await expectNoA11yViolations(container);
  });
});
