import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ChipStrip } from "./chip-strip";
import { StatCard } from "./stat-card";

describe("ChipStrip a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ChipStrip label="Invoice totals" className="grid grid-cols-4 gap-4">
        <StatCard label="Outstanding" value="$31,228.00" detail="7 invoices" />
        <StatCard label="Overdue" value="$4,542.50" tone="critical" />
      </ChipStrip>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-57: keeps the page's desktop layout and marks itself for the phone's chip styles", () => {
    render(
      <ChipStrip label="Invoice totals" className="grid grid-cols-4 gap-4">
        <StatCard label="Outstanding" value="$31,228.00" detail="7 invoices" />
      </ChipStrip>,
    );
    const strip = screen.getByRole("group", { name: "Invoice totals" });
    expect(strip.hasAttribute("data-chip-strip")).toBe(true);
    expect(strip.className).toContain("grid-cols-4");
    expect(strip.className).toContain("max-md:overflow-x-auto");
    // The card's parts are marked, so CSS can hide its detail and shrink its figure on a phone.
    expect(strip.querySelector("[data-stat-card] [data-stat-value]")?.textContent).toBe("$31,228.00");
    expect(strip.querySelector("[data-stat-detail]")?.textContent).toBe("7 invoices");
  });

  it("US-OPS-57: when it scrolls and no card can take focus, it's a focusable, named region; with buttons, no extra tab stop", () => {
    const sw = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(800);
    const cw = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
    const { unmount } = render(
      <ChipStrip>
        <StatCard label="Posted" value="12" />
      </ChipStrip>,
    );
    const region = screen.getByRole("region", { name: "Summary, scrolls sideways" });
    expect(region.getAttribute("tabindex")).toBe("0");
    unmount();
    render(
      <ChipStrip label="Invoice totals">
        <button type="button">Overdue</button>
      </ChipStrip>,
    );
    expect(screen.getByRole("group", { name: "Invoice totals" }).hasAttribute("tabindex")).toBe(false);
    sw.mockRestore();
    cw.mockRestore();
  });
});
