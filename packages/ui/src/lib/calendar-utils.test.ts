import { describe, expect, it } from "vitest";
import { expandRecurringEvent, type CalendarEvent } from "./calendar-utils.ts";

function weeklyEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    title: "Weekly sync",
    start: new Date("2026-01-05T10:00:00.000Z"),
    end: new Date("2026-01-05T11:00:00.000Z"),
    color: "blue",
    recurrence: { frequency: "weekly", end: { type: "count", count: 5 } },
    ...overrides,
  };
}

const rangeStart = new Date("2026-01-01T00:00:00.000Z");
const rangeEnd = new Date("2026-03-01T00:00:00.000Z");

describe("expandRecurringEvent — occurrence exceptions (PRD S-01.14)", () => {
  it("skips a cancelled occurrence, leaving others unaffected", () => {
    const event = weeklyEvent({
      occurrenceExceptions: [{ occurrenceDate: new Date("2026-01-12T10:00:00.000Z"), status: "cancelled" }],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);

    expect(instances).toHaveLength(4);
    expect(instances.some((i) => i.occurrenceStart.getTime() === new Date("2026-01-12T10:00:00.000Z").getTime())).toBe(false);
    // Surrounding occurrences still present and untouched.
    expect(instances.some((i) => i.occurrenceStart.getTime() === new Date("2026-01-05T10:00:00.000Z").getTime())).toBe(true);
    expect(instances.some((i) => i.occurrenceStart.getTime() === new Date("2026-01-19T10:00:00.000Z").getTime())).toBe(true);
  });

  it("count/walk logic still advances correctly through a cancelled slot (no off-by-one)", () => {
    // count:5 means 5 occurrences are "consumed" by the rule even though one renders as cancelled.
    const event = weeklyEvent({
      recurrence: { frequency: "weekly", end: { type: "count", count: 2 } },
      occurrenceExceptions: [{ occurrenceDate: new Date("2026-01-05T10:00:00.000Z"), status: "cancelled" }],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    // Only the 2nd occurrence (Jan 12) should render; the walk must not
    // treat the cancelled slot as "still owed" and produce a 3rd occurrence.
    expect(instances).toHaveLength(1);
    expect(instances[0]?.occurrenceStart.getTime()).toBe(new Date("2026-01-12T10:00:00.000Z").getTime());
  });

  it("applies a modified exception's start/end override to the matching instance only", () => {
    const event = weeklyEvent({
      occurrenceExceptions: [
        {
          occurrenceDate: new Date("2026-01-12T10:00:00.000Z"),
          status: "modified",
          start: new Date("2026-01-13T15:00:00.000Z"),
          end: new Date("2026-01-13T16:00:00.000Z"),
        },
      ],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    const modified = instances.find((i) => i.instanceId === `evt-1::${new Date("2026-01-12T10:00:00.000Z").toISOString()}`);
    const untouched = instances.find((i) => i.occurrenceStart.getTime() === new Date("2026-01-05T10:00:00.000Z").getTime());

    expect(modified?.occurrenceStart.getTime()).toBe(new Date("2026-01-13T15:00:00.000Z").getTime());
    expect(modified?.occurrenceEnd.getTime()).toBe(new Date("2026-01-13T16:00:00.000Z").getTime());
    expect(untouched?.occurrenceStart.getTime()).toBe(new Date("2026-01-05T10:00:00.000Z").getTime());
  });

  it("keeps originalOccurrenceStart fixed at the series-computed date even when a modified exception overrides the displayed time (regression: a second edit must key on the same date as the first)", () => {
    const event = weeklyEvent({
      occurrenceExceptions: [
        {
          occurrenceDate: new Date("2026-01-12T10:00:00.000Z"),
          status: "modified",
          start: new Date("2026-01-13T15:00:00.000Z"),
          end: new Date("2026-01-13T16:00:00.000Z"),
        },
      ],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    const modified = instances.find((i) => i.occurrenceStart.getTime() === new Date("2026-01-13T15:00:00.000Z").getTime());

    // Displayed start reflects the override...
    expect(modified?.occurrenceStart.getTime()).toBe(new Date("2026-01-13T15:00:00.000Z").getTime());
    // ...but the key a second edit must send back as occurrenceDate stays
    // the original, unmodified series-computed date, not the overridden one.
    expect(modified?.originalOccurrenceStart.getTime()).toBe(new Date("2026-01-12T10:00:00.000Z").getTime());

    const untouched = instances.find((i) => i.occurrenceStart.getTime() === new Date("2026-01-05T10:00:00.000Z").getTime());
    expect(untouched?.originalOccurrenceStart.getTime()).toBe(new Date("2026-01-05T10:00:00.000Z").getTime());
  });

  it("applies a modified exception's title/location/description override without mutating the shared series event", () => {
    const event = weeklyEvent({
      description: "Series description",
      occurrenceExceptions: [
        {
          occurrenceDate: new Date("2026-01-12T10:00:00.000Z"),
          status: "modified",
          title: "Rescheduled sync",
          location: "Room B",
        },
      ],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    const modified = instances.find((i) => i.occurrenceStart.getTime() === new Date("2026-01-12T10:00:00.000Z").getTime() || i.instanceId.includes("2026-01-12"));
    const untouched = instances.find((i) => i.occurrenceStart.getTime() === new Date("2026-01-05T10:00:00.000Z").getTime());

    expect(modified?.event.title).toBe("Rescheduled sync");
    expect(modified?.event.location).toBe("Room B");
    expect(modified?.event.description).toBe("Series description");

    // Mutation-safety: the untouched instance and the original event object
    // must not have been altered by constructing the modified clone.
    expect(untouched?.event.title).toBe("Weekly sync");
    expect(event.title).toBe("Weekly sync");
  });

  it("a non-recurring event ignores occurrenceExceptions entirely", () => {
    const event: CalendarEvent = {
      id: "evt-2",
      title: "One-off",
      start: new Date("2026-01-05T10:00:00.000Z"),
      end: new Date("2026-01-05T11:00:00.000Z"),
      color: "blue",
      occurrenceExceptions: [{ occurrenceDate: new Date("2026-01-05T10:00:00.000Z"), status: "cancelled" }],
    };
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.event.title).toBe("One-off");
  });

  it("an exception on an occurrence date beyond MAX_OCCURRENCES/hardCount has no effect", () => {
    const event = weeklyEvent({
      recurrence: { frequency: "weekly", end: { type: "count", count: 5 } },
      occurrenceExceptions: [{ occurrenceDate: new Date("2027-01-01T10:00:00.000Z"), status: "cancelled" }],
    });
    const instances = expandRecurringEvent(event, rangeStart, rangeEnd);
    expect(instances).toHaveLength(5);
  });
});
