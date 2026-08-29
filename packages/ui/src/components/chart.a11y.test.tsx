import { render } from "@testing-library/react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";

const data = [
  { month: "Mar", revenue: 18400 },
  { month: "Apr", revenue: 21200 },
  { month: "May", revenue: 19800 },
  { month: "Jun", revenue: 24600 },
];

const config: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--color-primary)" },
};

describe("Chart a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
        </BarChart>
      </ChartContainer>,
    );
    await expectNoA11yViolations(container);
  });
});
