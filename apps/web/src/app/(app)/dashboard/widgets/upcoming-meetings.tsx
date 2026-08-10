"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

type MeetingColor = "blue" | "green" | "amber" | "red" | "purple" | "teal" | "pink" | "slate";

interface Meeting {
  id: string;
  title: string;
  startAt: string;
  contactId: string | null;
  color: MeetingColor;
}

/** Same literal-class convention as calendar.tsx's own COLOR_CLASSES — a Tailwind content scanner needs to see each class name as literal text, not assembled at runtime. */
const DOT_CLASSES: Record<MeetingColor, string> = {
  blue: "bg-category-blue",
  green: "bg-category-green",
  amber: "bg-category-amber",
  red: "bg-category-red",
  purple: "bg-category-purple",
  teal: "bg-category-teal",
  pink: "bg-category-pink",
  slate: "bg-category-slate",
};

function formatWhen(startAt: string): string {
  const d = new Date(startAt);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

/**
 * S-09.12/S-10.19 (dashboard v2) — "upcoming meetings" widget. Reads
 * `GET /meetings/upcoming`, which already applies the org's
 * `dashboard_meetings_scope` setting (and Field's hard own-only rule)
 * server-side — this component has no scope logic of its own.
 */
export function UpcomingMeetings() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<Meeting[]>("/meetings/upcoming")
      .then(setMeetings)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Upcoming meetings
          <Link href="/meetings" className="text-[13px] font-normal text-primary hover:underline">
            View calendar
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!meetings ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : meetings.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing in the next 7 days.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {meetings.map((m) => (
              <Link key={m.id} href="/meetings" className="flex items-center gap-2.5 rounded-sm px-1 py-1.5 text-[13px] hover:bg-surface-secondary">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[m.color]}`} />
                <div className="flex flex-col">
                  <span className="text-on-surface">{m.title}</span>
                  <span className="text-[11px] text-on-surface-muted">{formatWhen(m.startAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
