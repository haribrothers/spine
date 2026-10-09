export interface Meeting {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
}

/** US-MOB-03 — meetings I organise or am invited to, in the next 7 days. */
export const NEXT_MEETINGS_KEY = "meetings:upcoming";
export const NEXT_MEETINGS_PATH = "/meetings/upcoming?attending=true&withinDays=7";

/** The next one that hasn't ended. */
export function nextMeeting(meetings: Meeting[], now: Date = new Date()): Meeting | null {
  return [...meetings].filter((m) => new Date(m.endAt) > now).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0] ?? null;
}
