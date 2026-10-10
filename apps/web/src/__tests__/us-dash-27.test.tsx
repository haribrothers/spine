import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiSkeleton, WidgetSkeleton } from "../app/(app)/dashboard/dashboard-skeleton";
import { CARD_GAP, ROW_UNIT, rowSpanFor } from "../app/(app)/dashboard/dashboard-layout";
import { FigureTrio } from "../app/(app)/dashboard/widgets/figure-trio";

describe("US-DASH-27 · placeholders", () => {
  it("draws each card's own outline, hidden from screen readers and still under Reduce Motion", () => {
    for (const kind of ["rows", "bars", "ring", "figures", "figure", "chart", "line"] as const) {
      const { container, unmount } = render(<WidgetSkeleton kind={kind} />);
      const outline = screen.getByTestId("widget-skeleton");
      expect(outline.getAttribute("aria-hidden")).toBe("true");
      const blocks = container.querySelectorAll(".animate-pulse");
      expect(blocks.length).toBeGreaterThan(0);
      blocks.forEach((b) => expect(b.className).toContain("motion-reduce:animate-none"));
      unmount();
    }
  });

  it("gives a KPI card the shape of its icon, figure, trend and change", () => {
    render(<KpiSkeleton />);
    expect(screen.getByTestId("kpi-skeleton").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("kpi-skeleton").querySelectorAll(".animate-pulse")).toHaveLength(5);
  });
});

describe("US-DASH-29 · cards keep their own height", () => {
  it("spans as many small rows as the card is tall, its gap included, and none when it shows nothing", () => {
    expect(rowSpanFor(0)).toBe(0);
    expect(rowSpanFor(184)).toBe(Math.ceil((184 + CARD_GAP) / ROW_UNIT));
    expect(rowSpanFor(185)).toBe(26);
  });
});

describe("US-DASH-28 · three figures", () => {
  it("labels each figure and keeps it on one line", () => {
    render(
      <FigureTrio
        figures={[
          { label: "Current", value: "₹1,80,540.00" },
          { label: "Overdue", value: "₹4,10,640.00", href: "/payables?overdue=1", "aria-label": "Overdue ₹4,10,640.00 — open overdue bills" },
          { label: "Total", value: "₹5,91,180.00" },
        ]}
      />,
    );
    expect(screen.getByText("₹1,80,540.00").className).toContain("whitespace-nowrap");
    expect(screen.getByRole("link", { name: "Overdue ₹4,10,640.00 — open overdue bills" }).getAttribute("href")).toBe("/payables?overdue=1");
    // Stacked by default; side by side only when the card is 30rem or wider.
    expect(screen.getByTestId("figure-trio").className).toContain("grid-cols-1");
    expect(screen.getByTestId("figure-trio").className).toContain("@[30rem]:grid-cols-3");
  });
});
