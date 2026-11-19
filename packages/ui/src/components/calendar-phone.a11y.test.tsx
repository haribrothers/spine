import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Calendar, type CalendarEvent } from "./calendar";
import { CalendarPhoneMonth, CalendarPhoneToolbar, CalendarWeekStrip } from "./calendar-phone";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const MARCH_10 = new Date(2027, 2, 10);
const events: CalendarEvent[] = [
  { id: "a", title: "Slab pour review", start: new Date(2027, 2, 10, 9), end: new Date(2027, 2, 10, 10), color: "blue", location: "Outer Ring Road" },
  { id: "b", title: "Crew briefing", start: new Date(2027, 2, 10, 14), end: new Date(2027, 2, 10, 14, 30), color: "green" },
  { id: "c", title: "Site handover", start: new Date(2027, 2, 11, 11), end: new Date(2027, 2, 11, 12), color: "amber" },
];
const LABELS = { day: "Day", week: "Week", month: "Month", agenda: "Agenda" } as const;

/** A sideways swipe: pointer down, then up `dx` pixels across. */
function swipe(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 104 });
}

describe("US-MTG-18 · a calendar made for my phone", () => {
  it("the month has one letter per weekday, the chosen day filled, dots with the count for screen readers, and the chosen day's meetings under it", async () => {
    const onDateChange = vi.fn();
    const { container } = render(<CalendarPhoneMonth date={MARCH_10} events={events} onDateChange={onDateChange} onEventClick={() => {}} />);
    const tenth = screen.getByRole("button", { name: "Wednesday 10 March, 2 meetings" });
    expect(tenth.getAttribute("aria-pressed")).toBe("true");
    expect(tenth.querySelectorAll(".rounded-full.h-1\\.5")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Thursday 11 March, 1 meeting" })).toBeTruthy();
    const list = screen.getByTestId("calendar-phone-day-list");
    expect(list.textContent).toContain("Slab pour review");
    expect(list.textContent).toContain("9:00 AM");
    expect(list.textContent).toContain("Outer Ring Road");
    expect(list.textContent).not.toContain("Site handover");
    await expectNoA11yViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "Thursday 11 March, 1 meeting" }));
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 2, 11));
    // Arrow keys move the day, a swipe the month.
    fireEvent.keyDown(tenth, { key: "ArrowDown" });
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 2, 17));
    swipe(screen.getByTestId("calendar-phone-month").parentElement!, -120);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 3, 10));
    swipe(screen.getByTestId("calendar-phone-month").parentElement!, 120);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 1, 10));
  });

  it("a mostly vertical drag (scrolling) isn't a swipe", () => {
    const onDateChange = vi.fn();
    render(<CalendarPhoneMonth date={MARCH_10} events={events} onDateChange={onDateChange} onEventClick={() => {}} />);
    const area = screen.getByTestId("calendar-phone-month").parentElement!;
    fireEvent.pointerDown(area, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area, { clientX: 260, clientY: 300 });
    expect(onDateChange).not.toHaveBeenCalled();
  });

  it("the week strip has the week's seven days with their dots; a swipe moves a week", async () => {
    const onDateChange = vi.fn();
    const { container } = render(<CalendarWeekStrip date={MARCH_10} events={events} onDateChange={onDateChange} />);
    const strip = screen.getByTestId("calendar-week-strip");
    expect(strip.querySelectorAll("button")).toHaveLength(7);
    expect(container.textContent).toContain("2 meetings");
    swipe(strip, -120);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 2, 17));
    await expectNoA11yViolations(container);
  });

  it("the toolbar: the month (tap to pick another), arrows, Today, and the views the width of the screen", async () => {
    const onDateChange = vi.fn();
    const onNext = vi.fn();
    const { baseElement } = render(
      <CalendarPhoneToolbar date={MARCH_10} view="month" views={["month", "day", "agenda"]} viewLabels={LABELS} onViewChange={() => {}} onDateChange={onDateChange} onPrev={() => {}} onNext={onNext} onToday={() => {}} />,
    );
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Month", "Day", "Agenda"]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /March 2027/ }));
    fireEvent.click(screen.getByRole("button", { name: "June 2027" }));
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(2027, 5, 10));
    await expectNoA11yViolations(baseElement);
  });

  it("Calendar on a phone: its own toolbar, the compact month and the quick view as a bottom sheet; from 768px up, the grid month", () => {
    asPhone(true);
    const { unmount } = render(
      <Calendar events={events} view="month" onViewChange={() => {}} date={MARCH_10} onDateChange={() => {}} renderEventPopover={({ instance }) => <p>Quick view of {instance.event.title}</p>} />,
    );
    expect(document.querySelector("[data-calendar-phone-toolbar]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Slab pour review/ }));
    expect(screen.getByTestId("calendar-quick-view-sheet").textContent).toContain("Quick view of Slab pour review");
    unmount();
    asPhone(false);
    render(<Calendar events={events} view="month" onViewChange={() => {}} date={MARCH_10} onDateChange={() => {}} />);
    expect(document.querySelector("[data-calendar-phone-toolbar]")).toBeNull();
    expect(screen.queryByTestId("calendar-phone-month")).toBeNull();
    expect(screen.getByRole("grid")).toBeTruthy();
  });
});
