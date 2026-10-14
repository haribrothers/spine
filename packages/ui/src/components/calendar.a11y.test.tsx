import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Calendar, calendarScrollHour, type CalendarEvent } from "./calendar";

function atTime(daysFromToday: number, hours: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function sampleEvents(): CalendarEvent[] {
  return [
    {
      id: "evt-1",
      title: "Site visit — Acme Contracting",
      start: atTime(0, 9, 0),
      end: atTime(0, 10, 30),
      color: "blue",
      location: "42 Harbour Rd",
    },
    {
      id: "evt-2",
      title: "Invoice due — Brightline Interiors",
      start: atTime(1, 0, 0),
      end: atTime(1, 23, 59),
      allDay: true,
      color: "amber",
    },
  ];
}

describe("Calendar a11y", () => {
  it("has no violations (week view)", async () => {
    const { container } = render(
      <div style={{ height: 640 }}>
        <Calendar
          events={sampleEvents()}
          view="week"
          onViewChange={() => {}}
          date={new Date()}
          onDateChange={() => {}}
          onEventCreate={() => {}}
          onEventUpdate={() => {}}
          onEventDelete={() => {}}
        />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (month view)", async () => {
    const { container } = render(
      <div style={{ height: 640 }}>
        <Calendar
          events={sampleEvents()}
          view="month"
          onViewChange={() => {}}
          date={new Date()}
          onDateChange={() => {}}
          onEventCreate={() => {}}
          onEventUpdate={() => {}}
          onEventDelete={() => {}}
        />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations (agenda view)", async () => {
    const { container } = render(
      <div style={{ height: 640 }}>
        <Calendar
          events={sampleEvents()}
          view="agenda"
          onViewChange={() => {}}
          date={new Date()}
          onDateChange={() => {}}
          onEventCreate={() => {}}
          onEventUpdate={() => {}}
          onEventDelete={() => {}}
        />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});

// US-MTG-14 and US-MTG-17 (D-212): a toolbar action, the views offered, a create request, the working day, the now line and richer agenda rows.
describe("US-MTG-14 · US-MTG-17 · Calendar", () => {
  const base = {
    onViewChange: () => {},
    onDateChange: () => {},
    onEventCreate: () => {},
    onEventUpdate: () => {},
    onEventDelete: () => {},
  };

  it("opens Day and Week at 8 AM, or the hour before now on today after 9 AM", () => {
    const monday = new Date(2026, 9, 5);
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 4 + i));
    expect(calendarScrollHour([monday], new Date(2026, 9, 6, 14, 20))).toBe(8);
    expect(calendarScrollHour(week, new Date(2026, 9, 6, 7, 30))).toBe(8);
    expect(calendarScrollHour(week, new Date(2026, 9, 6, 14, 20))).toBe(13);
    expect(calendarScrollHour([monday], new Date(2026, 9, 5, 9, 5))).toBe(8);
  });

  it("puts a toolbar action before the views, offers only the views given, and has no violations", async () => {
    const { container } = render(
      <div style={{ height: 640 }}>
        <Calendar {...base} events={sampleEvents()} view="agenda" date={new Date()} views={["day", "month", "agenda"]} toolbarAction={<button type="button">New meeting</button>} />
      </div>,
    );
    expect(screen.getByRole("button", { name: "New meeting" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Week view" })).toBeNull();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Day view", "Month view", "Agenda view"]);
    await expectNoA11yViolations(container);
  });

  it("opens the create dialog for a requested range", () => {
    const start = atTime(0, 15, 0);
    const end = atTime(0, 15, 30);
    render(
      <div style={{ height: 640 }}>
        <Calendar {...base} events={[]} view="week" date={new Date()} createRequest={{ start, end }} />
      </div>,
    );
    expect(screen.getByRole("dialog", { name: "New event" })).toBeTruthy();
  });

  it("marks the current time on today's column only", () => {
    const { container, rerender } = render(
      <div style={{ height: 640 }}>
        <Calendar {...base} events={[]} view="week" date={new Date()} />
      </div>,
    );
    expect(container.querySelectorAll("[data-now-line]")).toHaveLength(1);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);
    rerender(
      <div style={{ height: 640 }}>
        <Calendar {...base} events={[]} view="week" date={lastWeek} />
      </div>,
    );
    expect(container.querySelectorAll("[data-now-line]")).toHaveLength(0);
  });

  it("shows an agenda row's time range, place and extra details", () => {
    render(
      <div style={{ height: 640 }}>
        <Calendar {...base} events={sampleEvents()} view="agenda" date={new Date()} agendaDetails={(i) => <span>For {i.event.title.split(" — ")[1]}</span>} />
      </div>,
    );
    const row = screen.getByRole("button", { name: /Site visit — Acme Contracting/ });
    expect(row.textContent).toContain("9:00 AM – 10:30 AM");
    expect(row.textContent).toContain("42 Harbour Rd");
    expect(row.textContent).toContain("For Acme Contracting");
  });
});
