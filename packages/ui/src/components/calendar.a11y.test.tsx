import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Calendar, type CalendarEvent } from "./calendar";

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
