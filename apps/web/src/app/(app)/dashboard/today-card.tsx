"use client";

import { useModules } from "../../../lib/modules-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, cn } from "@spine/ui";
import { buildToday, type TodayEntry, type TodayFollowup, type TodayKind, type TodayMeeting, type TodayMilestone } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { WidgetSkeleton } from "./dashboard-skeleton";

/** The bar beside each entry; the kind is also written out, so colour is never the only cue. */
const BAR: Record<TodayKind, string> = {
  meeting: "bg-primary",
  milestone: "bg-due-soon",
  followup: "bg-on-surface",
};

/**
 * US-DASH-16 — "Today": my meetings today, milestones due within 7 days on
 * jobs I can see, my follow-ups due today or overdue, and my next meeting
 * after today, in time order. The three lists come from their own
 * endpoints and are merged by `buildToday`; a source the member can't read
 * counts as empty.
 */
export function TodayCard({ className }: { className?: string }) {
  const t = useT();
  const [entries, setEntries] = useState<TodayEntry[] | null>(null);
  const { modules } = useModules();

  useEffect(() => {
    if (!modules) return;
    const safe = <T,>(path: string) => apiClient.get<T[]>(path).catch(() => [] as T[]);
    // US-SET-24: nothing from a switched-off module.
    void Promise.all([
      modules.leadsMeetings ? safe<TodayMeeting>("/meetings/upcoming?withinDays=14") : Promise.resolve([] as TodayMeeting[]),
      modules.jobsField ? safe<TodayMilestone>("/jobs/milestones/due?withinDays=7") : Promise.resolve([] as TodayMilestone[]),
      safe<TodayFollowup>("/activities/overdue?includeToday=true"),
    ]).then(([meetings, milestones, followups]) => setEntries(buildToday({ meetings, milestones, followups, now: new Date() })));
  }, [modules]);

  return (
    <Card className={cn("flex flex-col gap-2", className)} data-testid="today-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-on-surface">{t("dashboard.today.title")}</h2>
        {modules?.leadsMeetings && (
          <Link href="/meetings?view=day" className="text-[13px] text-primary hover:underline">
            {t("dashboard.today.openCalendar")}
          </Link>
        )}
      </div>
      {!entries ? (
        <div className="pt-2">
          <WidgetSkeleton kind="rows" rows={2} />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-on-surface-muted">{t("dashboard.today.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} data-kind={entry.kind}>
              <Link href={entry.href} className="flex items-stretch gap-3 rounded-sm py-3 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="w-24 shrink-0 text-[12px] text-on-surface-muted">{entry.when}</span>
                <span className={cn("w-0.5 shrink-0 rounded-full", BAR[entry.kind])} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold text-on-surface">{entry.title}</span>
                  <span className="truncate text-[12px] text-on-surface-muted">{entry.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
