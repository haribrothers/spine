import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { MiniCalendar, miniCalendarDayKey } from "./calendar-mini";

describe("MiniCalendar a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<MiniCalendar onSelect={() => {}} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations with a selected date", async () => {
    const { container } = render(<MiniCalendar selected={new Date()} onSelect={() => {}} />);
    await expectNoA11yViolations(container);
  });
});

// US-MTG-13 (D-212): busy days, the shaded range and a month that follows a larger calendar.
describe("US-MTG-13 · MiniCalendar marks, range and controlled month", () => {
  const month = new Date(2026, 9, 10);
  const marks = new Map([
    [miniCalendarDayKey(new Date(2026, 9, 7)), 2],
    [miniCalendarDayKey(new Date(2026, 9, 12)), 1],
  ]);

  it("has no violations with marks and a shaded week", async () => {
    const { container } = render(
      <MiniCalendar selected={month} onSelect={() => {}} month={month} onMonthChange={() => {}} marks={marks} highlight={{ start: new Date(2026, 9, 4), end: new Date(2026, 9, 10) }} />,
    );
    await expectNoA11yViolations(container);
  });

  it("dots a busy day and says its count; a free day reads as before", () => {
    render(<MiniCalendar selected={month} onSelect={() => {}} month={month} onMonthChange={() => {}} marks={marks} markLabel={(n) => `${n} meetings`} />);
    const busy = screen.getByRole("gridcell", { name: /October 7, 2026, 2 meetings$/ });
    expect(busy.getAttribute("data-marked")).toBe("true");
    const free = screen.getByRole("gridcell", { name: /October 8, 2026$/ });
    expect(free.getAttribute("data-marked")).toBeNull();
  });

  it("shades the range as one band across the week", () => {
    const { container } = render(<MiniCalendar selected={month} onSelect={() => {}} month={month} onMonthChange={() => {}} highlight={{ start: new Date(2026, 9, 4), end: new Date(2026, 9, 10) }} />);
    const bands = container.querySelectorAll("[data-range-band]");
    expect(bands).toHaveLength(1);
    expect((bands[0] as HTMLElement).style.gridColumn).toBe("1 / 8");
    expect(screen.getByRole("gridcell", { name: /October 6, 2026$/ }).getAttribute("data-in-range")).toBe("true");
    expect(screen.getByRole("gridcell", { name: /October 11, 2026$/ }).getAttribute("data-in-range")).toBeNull();
  });

  it("shows the month it's given and asks for another when paged", () => {
    const onMonthChange = vi.fn();
    const { rerender } = render(<MiniCalendar onSelect={() => {}} month={month} onMonthChange={onMonthChange} />);
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 10, 1));
    rerender(<MiniCalendar onSelect={() => {}} month={new Date(2026, 11, 3)} onMonthChange={onMonthChange} />);
    expect(screen.getByRole("grid", { name: "December 2026" })).toBeTruthy();
  });
});
