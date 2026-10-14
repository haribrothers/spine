import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { SegmentedBar } from "./segmented-bar";

const segments = [
  { key: "current", label: "Current", value: 30623, formattedValue: "$30,623.00", color: "var(--color-paid)" },
  { key: "0-30", label: "1–30 days", value: 4542.5, formattedValue: "$4,542.50", color: "var(--color-due-soon)" },
  { key: "90+", label: "90+ days", value: 0, formattedValue: "$0.00", color: "var(--color-overdue)" },
];

describe("SegmentedBar a11y", () => {
  it("has no violations, and names every part in text", async () => {
    const { container, getByRole } = render(<SegmentedBar segments={segments} aria-label="Receivables by age" />);
    expect(getByRole("img").getAttribute("aria-label")).toBe("Receivables by age: Current $30,623.00, 1–30 days $4,542.50, 90+ days $0.00");
    expect(container.textContent).toContain("87%");
    await expectNoA11yViolations(container);
  });

  it("has no violations in the empty state", async () => {
    const { container } = render(<SegmentedBar segments={segments.map((s) => ({ ...s, value: 0 }))} aria-label="Receivables by age" emptyState="Nothing outstanding." />);
    expect(container.textContent).toContain("Nothing outstanding.");
    await expectNoA11yViolations(container);
  });

  it("has no violations when its parts can be pressed, and says which is pressed (US-PAY-29)", async () => {
    const pressed: string[] = [];
    const { container, getByRole } = render(<SegmentedBar segments={segments} aria-label="Receivables by age" onSegmentClick={(key) => pressed.push(key)} selectedKeys={["0-30"]} />);
    await expectNoA11yViolations(container);
    expect(getByRole("button", { name: /1–30 days/ }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: /Current/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(getByRole("button", { name: /Current/ }));
    expect(pressed).toEqual(["current"]);
  });
});
