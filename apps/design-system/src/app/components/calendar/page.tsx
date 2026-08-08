"use client";

import { Calendar, type CalendarEvent, type CalendarView } from "@spine/ui";
import { useMemo, useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocSubsection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

function atTime(daysFromToday: number, hours: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Job-site/business-relevant sample events per docs/spine-prd.md's domain (§enquiry→quote→job→invoice→payment). */
function buildSampleEvents(): CalendarEvent[] {
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
      title: "Team standup",
      start: atTime(0, 9, 15),
      end: atTime(0, 9, 30),
      color: "slate",
      recurrence: { frequency: "daily", interval: 1, end: { type: "count", count: 30 } },
    },
    {
      id: "evt-3",
      title: "Quote review — Brightline Interiors",
      start: atTime(0, 9, 45),
      end: atTime(0, 10, 45),
      color: "purple",
    },
    {
      id: "evt-4",
      title: "Invoice due — Brightline Interiors",
      start: atTime(1, 0, 0),
      end: atTime(1, 23, 59),
      allDay: true,
      color: "amber",
    },
    {
      id: "evt-5",
      title: "Fabrication — Coastal Fabrication Co.",
      start: atTime(1, 8, 0),
      end: atTime(3, 17, 0),
      color: "teal",
      location: "Workshop Bay 2",
    },
    {
      id: "evt-6",
      title: "Client call — Delta Electrical",
      start: atTime(2, 11, 0),
      end: atTime(2, 11, 30),
      color: "green",
    },
    {
      id: "evt-7",
      title: "Milestone inspection — Acme Contracting",
      start: atTime(2, 13, 0),
      end: atTime(2, 14, 0),
      color: "blue",
    },
    {
      id: "evt-8",
      title: "Payment follow-up — overdue accounts",
      start: atTime(3, 10, 0),
      end: atTime(3, 10, 30),
      color: "red",
    },
    {
      id: "evt-9",
      title: "Weekly ops review",
      start: atTime(4, 15, 0),
      end: atTime(4, 16, 0),
      color: "slate",
      recurrence: { frequency: "weekly", interval: 1, end: { type: "count", count: 12 } },
    },
    {
      id: "evt-10",
      title: "Design studio walkthrough",
      start: atTime(4, 15, 15),
      end: atTime(4, 15, 45),
      color: "pink",
    },
    {
      id: "evt-11",
      title: "Materials delivery — Coastal Fabrication",
      start: atTime(5, 8, 30),
      end: atTime(5, 9, 0),
      color: "teal",
    },
    {
      id: "evt-12",
      title: "Monthly invoicing run",
      start: startOfToday(),
      end: startOfToday(),
      allDay: true,
      color: "amber",
      recurrence: { frequency: "monthly", interval: 1, end: { type: "count", count: 6 } },
    },
  ];
}

function CalendarDemo() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => buildSampleEvents());
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());

  return (
    <div className="h-[640px] w-full">
      <Calendar
        events={events}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onEventCreate={(event) => setEvents((prev) => [...prev, event])}
        onEventUpdate={(event) => setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))}
        onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
      />
    </div>
  );
}

function ControlledWeekDemo() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => buildSampleEvents());
  const [date, setDate] = useState(new Date());

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-on-surface-muted">Focused date: {date.toLocaleDateString()}</p>
      <div className="h-[560px] w-full">
        <Calendar
          events={events}
          view="week"
          onViewChange={() => {}}
          date={date}
          onDateChange={setDate}
          onEventCreate={(event) => setEvents((prev) => [...prev, event])}
          onEventUpdate={(event) => setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))}
          onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
        />
      </div>
    </div>
  );
}

function RecurrenceDemo() {
  const initialEvents = useMemo<CalendarEvent[]>(
    () => [
      {
        id: "recur-standup",
        title: "Team standup",
        start: atTime(0, 9, 0),
        end: atTime(0, 9, 15),
        color: "blue",
        recurrence: { frequency: "daily", interval: 1, end: { type: "count", count: 20 } },
      },
      {
        id: "recur-invoicing",
        title: "Monthly invoicing run",
        start: startOfToday(),
        end: startOfToday(),
        allDay: true,
        color: "amber",
        recurrence: { frequency: "monthly", interval: 1, end: { type: "date", date: atTime(365, 0, 0) } },
      },
    ],
    [],
  );
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [view, setView] = useState<CalendarView>("month");
  const [date, setDate] = useState(new Date());

  return (
    <div className="h-[600px] w-full">
      <Calendar
        events={events}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        onEventCreate={(event) => setEvents((prev) => [...prev, event])}
        onEventUpdate={(event) => setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))}
        onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
      />
    </div>
  );
}

const SAMPLE_CONTACTS = [
  { value: "acme", label: "Acme Contracting Ltd." },
  { value: "brightline", label: "Brightline Interiors" },
  { value: "coastal", label: "Coastal Fabrication Co." },
];

function ContactLinkDemo() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => [
    {
      id: "site-visit",
      title: "Site visit — foundation inspection",
      start: atTime(0, 10, 0),
      end: atTime(0, 11, 0),
      color: "green",
      contactId: "acme",
    },
  ]);
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());

  return (
    <div className="h-[480px] w-full">
      <Calendar
        events={events}
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        contactOptions={SAMPLE_CONTACTS}
        onEventCreate={(event) => setEvents((prev) => [...prev, event])}
        onEventUpdate={(event) => setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))}
        onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <div>
      <DocTitle>Calendar</DocTitle>
      <DocLead>
        An Outlook-style scheduling calendar with Day, Week, Month, and Agenda views. Drag an
        empty slot to create an event, drag an existing event to move it, drag its edges to
        resize (Day/Week), and overlapping events lay out side-by-side rather than stacking.
        Supports all-day and multi-day events, a fixed color-coded category palette, and simple
        daily/weekly/monthly recurrence with an end date or occurrence count.
      </DocLead>

      <ComponentPreview>
        <CalendarDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Day, Week, Month, and Agenda views, switchable via a toolbar view toggle.",
            "Click-and-drag on an empty time slot to create an event, pre-filled with the dragged time range.",
            "Drag an existing event to move it to a new time or day; drag its top/bottom edge to resize (Day/Week only).",
            "Overlapping events in the same time range lay out side-by-side via a greedy column-assignment algorithm, never stacked illegibly.",
            "All-day events render in a dedicated all-day strip (Day/Week) or as full-width bars (Month).",
            "Multi-day events render as spanning bars across Month/Week.",
            "Simple recurrence — daily/weekly/monthly with an end date or occurrence count — expanded into concrete instances per visible range via date-fns, including month-boundary and DST-adjacent arithmetic.",
            "A fixed 8-color category palette (docs/DESIGN.md's category-* tokens), assigned per event.",
            "A mini month-picker in the toolbar (built on the same MiniCalendar DatePicker uses) to jump the visible range to any date.",
            "Prev / Today / Next navigation, scoped to the active view's step size.",
            "Fully controlled — the caller owns events, view, and date; drag/resize/create interaction state stays internal.",
            "Optional contactOptions prop adds a Contact field to the event editor (a searchable Combobox) so an event can optionally link to an external record — first used by the /meetings page (S-01.9) to schedule meetings against a CRM contact.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <DocLead>
          Calendar is a single top-level component — Day/Week/Month/Agenda views, the toolbar,
          and the event editor are internal and not separately exported.
        </DocLead>
        <CodeBlock
          code={`import { Calendar, type CalendarEvent, type CalendarView } from "@spine/ui";

export default function Example() {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [view, setView] = useState<CalendarView>("week");
  const [date, setDate] = useState(new Date());

  return (
    <Calendar
      events={events}
      view={view}
      onViewChange={setView}
      date={date}
      onDateChange={setDate}
      onEventCreate={(event) => setEvents((prev) => [...prev, event])}
      onEventUpdate={(event) =>
        setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))
      }
      onEventDelete={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
    />
  );
}`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <DocSubsection id="calendar-props" title="Calendar">
          <ApiTable
            rows={[
              { prop: "events", type: "CalendarEvent[]" },
              { prop: "onEventCreate", type: "(event: CalendarEvent) => void" },
              { prop: "onEventUpdate", type: "(event: CalendarEvent) => void" },
              { prop: "onEventDelete", type: "(eventId: string) => void" },
              { prop: "view", type: '"day" | "week" | "month" | "agenda"' },
              { prop: "onViewChange", type: "(view: CalendarView) => void" },
              { prop: "date", type: "Date" },
              { prop: "onDateChange", type: "(date: Date) => void" },
              {
                prop: "contactOptions",
                type: "{ value: string; label: string }[]",
                description: "When set, the event editor shows an optional Contact field and round-trips the pick via CalendarEvent.contactId. Omit for a calendar with no contact concept.",
              },
              { prop: "className", type: "string" },
            ]}
          />
        </DocSubsection>
        <DocSubsection id="calendar-event" title="CalendarEvent">
          <DocLead>The shape of a single event, recurring or not.</DocLead>
          <ApiTable
            rows={[
              { prop: "id", type: "string" },
              { prop: "title", type: "string" },
              { prop: "start", type: "Date" },
              { prop: "end", type: "Date" },
              { prop: "allDay", type: "boolean", defaultValue: "false" },
              {
                prop: "color",
                type: '"blue" | "green" | "amber" | "red" | "purple" | "teal" | "pink" | "slate"',
              },
              { prop: "location", type: "string" },
              { prop: "description", type: "string" },
              { prop: "recurrence", type: "CalendarRecurrenceRule" },
              { prop: "contactId", type: "string", description: "Set via the editor's Contact field when CalendarProps.contactOptions is provided." },
            ]}
          />
        </DocSubsection>
        <DocSubsection id="calendar-recurrence-rule" title="CalendarRecurrenceRule">
          <ApiTable
            rows={[
              { prop: "frequency", type: '"daily" | "weekly" | "monthly"' },
              { prop: "interval", type: "number", defaultValue: "1" },
              {
                prop: "end",
                type: '{ type: "date"; date: Date } | { type: "count"; count: number }',
              },
            ]}
          />
          <p className="mt-2 text-[13px] text-on-surface-muted">
            No per-occurrence exceptions — editing a recurring event edits the whole series, not
            a single instance.
          </p>
        </DocSubsection>
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocSubsection id="default-week" title="Default — sample job-site events">
          <DocLead>
            A full week of sample events for a small contracting business, including a daily
            standup, overlapping morning meetings, an all-day invoice-due marker, and a
            multi-day fabrication job.
          </DocLead>
          <ComponentPreview>
            <CalendarDemo />
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection id="controlled-week-view" title="Controlled week view">
          <DocLead>
            The view is fixed to Week and the focused date is displayed alongside the calendar,
            demonstrating the controlled date/view contract.
          </DocLead>
          <ComponentPreview>
            <ControlledWeekDemo />
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection id="recurrence" title="Recurrence">
          <DocLead>
            A daily standup (20 occurrences) and a monthly invoicing run (repeating for a year),
            shown in Month view where the recurrence icon marks each expanded instance.
          </DocLead>
          <ComponentPreview>
            <RecurrenceDemo />
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection id="contact-link" title="Linked to a contact">
          <DocLead>
            Passing <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">contactOptions</code> adds
            an optional Contact field to the event editor — click the existing "Site visit" event
            below and note the Contact field pre-filled to "Acme Contracting Ltd.", or create a new
            event and pick a contact yourself. This is how the /meetings page (S-01.9) links a
            scheduled meeting to a CRM contact, which then also surfaces on that contact's own
            Timeline tab.
          </DocLead>
          <ComponentPreview>
            <ContactLinkDemo />
          </ComponentPreview>
        </DocSubsection>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Month view's day cells are a roving-tabindex grid (arrow keys move focus, Enter/Space
          opens the event editor pre-filled for that day). Every event surface (Day/Week grid
          blocks, Month bars, Agenda rows) is a real button or has a button role with an
          accessible name describing its title and time range. The event editor is a Dialog,
          inheriting Radix's focus trap and Escape-to-close. A drag-create/move/resize in
          progress can always be cancelled with Escape before it commits.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus between the toolbar, the day/week/month grid, and events." },
            { keys: "ArrowRight", description: "Month view: moves focus to the next day cell." },
            { keys: "ArrowLeft", description: "Month view: moves focus to the previous day cell." },
            { keys: "ArrowDown", description: "Month view: moves focus one week forward." },
            { keys: "ArrowUp", description: "Month view: moves focus one week back." },
            { keys: "Enter / Space", description: "Activates focused day (opens the event editor) or focused event (opens it for editing)." },
            { keys: "Esc", description: "Cancels an in-progress drag (create/move/resize) without committing it, or closes the event editor." },
          ]}
        />
      </DocSection>
    </div>
  );
}
