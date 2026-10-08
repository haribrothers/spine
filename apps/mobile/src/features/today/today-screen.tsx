import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Camera from "lucide-react-native/icons/camera";
import CloudOff from "lucide-react-native/icons/cloud-off";
import Flag from "lucide-react-native/icons/flag";
import Images from "lucide-react-native/icons/images";
import Navigation from "lucide-react-native/icons/navigation";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import ScanLine from "lucide-react-native/icons/scan-line";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import Wallet from "lucide-react-native/icons/wallet";
import { ActionTile, GaugeIndicator, KpiCard, ScrollEdgeMask, SegmentedControl, useNativeColors } from "@spine/ui-native";
import type { GradientTone } from "@spine/ui-native/tokens";
import { useSignedInSession } from "../../lib/session/session-provider";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useModules } from "../../lib/data/modules";
import { useBusinessFormat } from "../../lib/data/business";
import { todaysJobs, useAssignedJobs } from "../../lib/data/jobs";
import { NEXT_MEETINGS_KEY, NEXT_MEETINGS_PATH, nextMeeting, type Meeting } from "../../lib/data/meetings";
import { PERIODS, todayKey, todayPath, type TodayPeriod, type TodaySummary } from "../../lib/data/today";
import { usePendingSummary, useOutboxItems } from "../../lib/outbox/pending";
import { jobWaiting, waitingChips } from "../../lib/outbox/job-waiting";
import { useOnline } from "../../lib/connectivity";
import { greeting } from "../../lib/member-display";
import { calendarDay, longDate, money, shortWhen, weekdayDayMonth, type BusinessFormat } from "../../lib/format";
import { openDirections } from "../../lib/linking";
import { arrivesLater } from "../../lib/later";
import { SectionHeader } from "../../components/section-header";
import { GaugeSkeleton, JobCardsSkeleton, KpiCardsSkeleton, MeetingCardSkeleton } from "../../components/skeletons";
import { ServerErrorState } from "../errors/server-error-state";
import { TodayJobCard } from "./job-card";

const KPI_CARD_WIDTH = 168;
const KPI_CARD_GAP = 12;
const PERIOD_WORD: Record<TodayPeriod, string> = { week: "week", month: "month", year: "year" };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** US-MOB-07 — what still works offline, and how fresh the saved jobs are. */
export function offlineMessage(savedAt: number | null, locale: string): string {
  const base = "Photos, expenses and milestone updates are saved on this phone and sync when you're back online.";
  return savedAt ? `${base} Showing jobs as of ${new Date(savedAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}.` : base;
}

interface Kpi {
  key: string;
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ size?: number; color?: string; opacity?: number }>;
  tone: GradientTone;
}

/** US-MOB-03 — the swipeable cards: milestones due and overdue, photos, my expenses. No other money (D-048). */
export function todayKpis(summary: TodaySummary, waitingPhotos: number, format: BusinessFormat, now: Date = new Date()): Kpi[] {
  const word = PERIOD_WORD[summary.period];
  const cards: Kpi[] = [];
  const m = summary.milestones;
  if (m) {
    cards.push({
      key: "due",
      label: `Due this ${word}`,
      value: String(m.due),
      trend: `${plural(m.due, "milestone", "milestones")}${m.nextDueDate ? ` · next ${shortWhen(m.nextDueDate, format.locale, now)}` : ""}`,
      icon: Flag,
      tone: "dueSoon",
    });
    const late = m.oldestOverdueDate ? Math.max(1, -Math.round((calendarDay(m.oldestOverdueDate).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)) : 0;
    cards.push({
      key: "overdue",
      label: "Overdue",
      value: String(m.overdue),
      trend: m.overdue ? `${plural(m.overdue, "milestone", "milestones")} · ${late} ${plural(late, "day", "days")} late` : "Nothing late",
      icon: TriangleAlert,
      tone: "overdue",
    });
  }
  if (summary.photos) {
    cards.push({
      key: "photos",
      label: "Photos",
      value: String(summary.photos.taken + waitingPhotos),
      trend: waitingPhotos ? `taken · ${waitingPhotos} waiting` : `taken this ${word}`,
      icon: Images,
      tone: "primary",
    });
  }
  const e = summary.expenses;
  cards.push({
    key: "expenses",
    label: "My expenses",
    value: money(e.total, { currency: e.currency, locale: format.locale }),
    trend: e.awaitingApproval ? `${e.awaitingApproval} waiting for approval` : `${e.count} this ${word}`,
    icon: Wallet,
    tone: "paid",
  });
  return cards;
}

function WelcomeCard({ summary, loading, period }: { summary: TodaySummary | null; loading: boolean; period: TodayPeriod }) {
  const colors = useNativeColors();
  const { member } = useSignedInSession();
  const format = useBusinessFormat();
  const m = summary?.milestones;
  return (
    <View testID="today-welcome" className="items-center gap-2 rounded-[20px] bg-surface-sunken p-5 dark:bg-surface-sunken-dark">
      <View className="w-full">
        <Text className="text-[26px] font-semibold text-on-surface dark:text-on-surface-dark">{greeting(member)}</Text>
        <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {member.organizationName} · {longDate(new Date(), format.locale)}
        </Text>
      </View>
      {loading ? (
        <GaugeSkeleton />
      ) : m ? (
        <>
          <GaugeIndicator progress={m.total ? m.done / m.total : 0} trackColor={colors.overlaySubtle} fillGradient={colors.gradients.primary} textColorClass="text-on-surface dark:text-on-surface-dark" />
          <View className="items-center gap-0.5" testID="today-gauge" accessible accessibilityLabel={`Milestones this ${PERIOD_WORD[period]}: ${m.done} of ${m.total} done`}>
            <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">Milestones this {PERIOD_WORD[period]}</Text>
            <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{m.total ? `${m.done} of ${m.total} done` : "None due"}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function NextMeetingCard({ meeting, locale, onOpen }: { meeting: Meeting; locale: string; onOpen: () => void }) {
  const colors = useNativeColors();
  const start = new Date(meeting.startAt);
  const when = meeting.allDay ? weekdayDayMonth(start, locale) : `${weekdayDayMonth(start, locale)}, ${start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
  return (
    <Pressable
      testID="today-next-meeting"
      onPress={onOpen}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:opacity-80 dark:border-border-dark dark:bg-surface-dark"
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-info-bg dark:bg-info-bg-dark">
        <CalendarClock size={22} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{meeting.title}</Text>
        <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{[when, meeting.location].filter(Boolean).join(" · ")}</Text>
      </View>
    </Pressable>
  );
}

/**
 * US-MOB-03 · `MobHome`, `MobHomeJobs` (and Android) — Today, following the
 * showcase-native home: the welcome card with the milestones gauge, the
 * period switch, the KPI cards, quick actions, "YOUR JOBS TODAY" and the
 * next meeting. The header has the sync pill, the bell and the avatar
 * (set in `(today)/_layout.tsx`). Jobs & field off hides every job part
 * (D-198); Leads & meetings off hides the meeting.
 */
export function TodayScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const modules = useModules();
  const pending = usePendingSummary();
  const queued = useOutboxItems();
  const online = useOnline();
  const [period, setPeriod] = useState<TodayPeriod>("month");

  const summary = useCachedQuery<TodaySummary>(todayKey(period), todayPath(period), { refreshOnForeground: true });
  const jobs = useAssignedJobs(modules.jobsField);
  const meetings = useCachedQuery<Meeting[]>(NEXT_MEETINGS_KEY, NEXT_MEETINGS_PATH, { enabled: modules.leadsMeetings });

  const now = new Date();
  const forToday = useMemo(() => (modules.jobsField ? todaysJobs(jobs.data ?? []) : []), [jobs.data, modules.jobsField]);
  const meeting = modules.leadsMeetings ? nextMeeting(meetings.data ?? []) : null;
  const kpis = summary.data ? todayKpis(summary.data, pending.photos, format, now) : [];

  const refreshing = summary.refreshing || jobs.refreshing || meetings.refreshing;
  const onRefresh = useCallback(async () => {
    await Promise.all([summary.refresh(), jobs.refresh(), meetings.refresh()]);
  }, [summary, jobs, meetings]);

  // US-MOB-07: the phone's own connection decides the banner, not a failed request.
  const offline = !online || [summary.status, jobs.status].includes("offline");
  const savedAt = jobs.fetchedAt ?? summary.fetchedAt;
  const unreachable = summary.status === "unreachable" && !summary.data;

  const firstSite = forToday.find((job) => job.siteAddress)?.siteAddress ?? null;
  const actions = [
    ...(modules.jobsField ? [{ label: "Add photo", icon: Camera, onPress: () => arrivesLater("Add photo") }] : []),
    { label: "Log expense", icon: ReceiptText, onPress: () => arrivesLater("Log expense") },
    { label: "Scan receipt", icon: ScanLine, onPress: () => arrivesLater("Scan receipt") },
    ...(modules.jobsField ? [{ label: "Directions", icon: Navigation, disabled: !firstSite, onPress: () => firstSite && void openDirections(firstSite) }] : []),
  ];

  const content = unreachable ? (
    <ServerErrorState
      onRetry={() => void onRefresh()}
      savedAt={jobs.fetchedAt ? new Date(jobs.fetchedAt).toLocaleTimeString(format.locale, { hour: "numeric", minute: "2-digit" }) : null}
      onShowSaved={() => router.navigate("/jobs")}
    />
  ) : (
    <>
      {offline ? (
        <View testID="offline-banner" accessibilityRole="alert" className="flex-row items-start gap-3 rounded-lg bg-draft-bg px-4 py-3.5 dark:bg-draft-bg-dark">
          <CloudOff size={20} color={colors.onSurfaceMuted} />
          <View className="flex-1 gap-1">
            <Text className="text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">{"You're offline"}</Text>
            <Text testID="offline-banner-text" className="text-[13px] text-on-surface dark:text-on-surface-dark">
              {offlineMessage(savedAt, format.locale)}
            </Text>
          </View>
        </View>
      ) : null}

      <WelcomeCard summary={summary.data} loading={summary.loading} period={period} />

      <SegmentedControl
        testID="today-period"
        values={PERIODS.map((p) => p.label)}
        value={PERIODS.find((p) => p.value === period)!.label}
        onValueChange={(label) => setPeriod(PERIODS.find((p) => p.label === label)?.value ?? "month")}
        style={{ height: 36 }}
      />

      {summary.loading ? (
        <KpiCardsSkeleton width={KPI_CARD_WIDTH} gap={KPI_CARD_GAP} />
      ) : kpis.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={KPI_CARD_WIDTH + KPI_CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ gap: KPI_CARD_GAP, paddingRight: 32 }}
          className="-mx-4"
          contentContainerClassName="px-4"
        >
          {kpis.map((kpi) => (
            <View key={kpi.key} testID={`today-kpi-${kpi.key}`} accessible accessibilityLabel={`${kpi.label}: ${kpi.value}, ${kpi.trend}`}>
              <KpiCard label={kpi.label} value={kpi.value} trend={kpi.trend} icon={kpi.icon} gradient={colors.gradients[kpi.tone]} gradientId={kpi.key} width={KPI_CARD_WIDTH} />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View className="gap-3">
        <SectionHeader title="Quick actions" />
        <View className="flex-row flex-wrap gap-3">
          {actions.map(({ label, icon, onPress, ...rest }) => (
            <ActionTile key={label} testID={`today-action-${label.toLowerCase().replace(/\s+/g, "-")}`} label={label} icon={icon} iconColor={colors.primary} onPress={onPress} disabled={"disabled" in rest ? rest.disabled : false} />
          ))}
        </View>
      </View>

      {modules.jobsField ? (
        <View className="gap-3" testID="today-jobs">
          <SectionHeader title="Your jobs today" count={jobs.loading ? undefined : forToday.length} action={{ label: "All jobs", arrow: true, onPress: () => router.navigate("/jobs") }} />
          {jobs.loading ? <JobCardsSkeleton /> : null}
          {forToday.map((job) => (
            <TodayJobCard key={job.id} job={job} locale={format.locale} now={now} waiting={waitingChips(jobWaiting(queued, job.id))} onOpen={() => router.push(`/jobs/${job.id}`)} />
          ))}
          {jobs.data && forToday.length === 0 ? (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">Nothing due on your jobs in the next 7 days.</Text>
          ) : null}
        </View>
      ) : null}

      {modules.leadsMeetings && meetings.loading ? (
        <View className="gap-3">
          <SectionHeader title="Next meeting" />
          <MeetingCardSkeleton />
        </View>
      ) : null}

      {meeting ? (
        <View className="gap-3">
          <SectionHeader title="Next meeting" />
          <NextMeetingCard meeting={meeting} locale={format.locale} onOpen={() => router.push(`/meetings/${meeting.id}`)} />
        </View>
      ) : null}
    </>
  );

  if (Platform.OS === "android") {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <ScrollView
          testID="today-scroll"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="gap-6 p-4"
          contentContainerStyle={{ paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurfaceMuted} />}
        >
          {content}
        </ScrollView>
        <ScrollEdgeMask edge="bottom" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="today-scroll"
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-6 px-4 pb-32 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurfaceMuted} />}
    >
      {content}
    </ScrollView>
  );
}
