import { useCallback } from "react";
import { Image, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import CircleCheck from "lucide-react-native/icons/circle-check";
import FileText from "lucide-react-native/icons/file-text";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import Phone from "lucide-react-native/icons/phone";
import { Avatar, EmptyState, useNativeColors } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { jobKey, milestonesKey, photosKey, quotesKey, useAssignedJobs, type FieldJob, type FieldMilestone, type JobPhoto, type QuoteToPresent } from "../../lib/data/jobs";
import { useBusinessFormat } from "../../lib/data/business";
import { useFileUri } from "../../lib/data/files";
import { calendarDay, dayMonth, daysUntil, oneLine, weekdayDayMonth } from "../../lib/format";
import { initials } from "../../lib/member-display";
import { callNumber, openDirections } from "../../lib/linking";
import { connectivity } from "../../lib/connectivity";
import { alertNeedsConnection } from "../quotes/needs-connection";
import { Fab } from "../../components/fab";
import { PillButton } from "../../components/pill-button";
import { SectionHeader } from "../../components/section-header";
import { JobStatusChip } from "./job-status";
import { useOutboxItems } from "../../lib/outbox/pending";
import { jobWaiting } from "../../lib/outbox/job-waiting";
import { WaitingChip } from "../../components/waiting-chip";
import type { OutboxItem } from "../../lib/outbox/types";
import { CardRowsSkeleton, HeadingSkeleton, ListRowsSkeleton, PhotoGridSkeleton } from "../../components/skeletons";
import { useCameraInk } from "../../lib/camera/ink";
import { useT } from "../../lib/i18n";

const PREVIEW_PHOTOS = 4;

export function jobSubtitle(job: Pick<FieldJob, "number" | "contactName">): string {
  return [job.number, job.contactName].filter(Boolean).join(" · ");
}

function MilestoneRow({ milestone, primary, first, locale, waiting, onComplete }: { milestone: FieldMilestone; primary: boolean; first: boolean; locale: string; waiting: boolean; onComplete: () => void }) {
  const t = useT();
  const colors = useNativeColors();
  const done = milestone.status !== "pending";
  const due = milestone.dueDate ? calendarDay(milestone.dueDate) : null;
  const days = due ? daysUntil(due) : null;
  // US-MOB-20: the other milestones' button is tonal — Material's primary-container on Android.
  const tonal = Platform.OS === "android" ? "bg-primary-container dark:bg-primary-container-dark" : "bg-info-bg dark:bg-info-bg-dark";
  const tonalText = Platform.OS === "android" ? "text-on-primary-container dark:text-on-primary-container-dark" : "text-primary dark:text-primary-dark";
  const dueClass = days === null ? "text-on-surface-muted dark:text-on-surface-muted-dark" : days < 0 ? "text-overdue dark:text-overdue-dark" : days < 7 ? "text-due-soon dark:text-due-soon-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark";
  return (
    <View testID={`milestone-${milestone.id}`} className={`flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-border dark:border-border-dark"}`}>
      <View className="flex-1 gap-0.5">
        <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{milestone.name}</Text>
        {done ? (
          <Text className="text-[14px] text-paid dark:text-paid-dark">{milestone.completedAt ? t("mobileWork.jobDetail.completedOn", { date: dayMonth(new Date(milestone.completedAt), locale) }) : t("mobileWork.common.completed")}</Text>
        ) : due ? (
          <Text className={`text-[14px] ${dueClass}`}>{t("mobileWork.jobDetail.due", { date: weekdayDayMonth(due, locale) })}</Text>
        ) : (
          <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.jobDetail.noDueDate")}</Text>
        )}
      </View>
      {done ? (
        <View accessible accessibilityLabel={t("mobileWork.common.completed")} className="flex-row items-center gap-1.5">
          <CircleCheck size={20} color={colors.paid} />
          <Text className="text-[15px] font-medium text-paid dark:text-paid-dark">{t("mobileWork.common.completed")}</Text>
        </View>
      ) : waiting ? (
        // US-MOB-07: completed on this phone, not yet at the office.
        <WaitingChip label={t("mobileWork.jobDetail.completionWaiting")} testID={`milestone-waiting-${milestone.id}`} />
      ) : (
        <Pressable
          testID={`milestone-complete-${milestone.id}`}
          onPress={onComplete}
          accessibilityRole="button"
          accessibilityLabel={t("mobileWork.jobDetail.markNameComplete", { name: milestone.name })}
          className={`min-h-[44px] items-center justify-center rounded-full px-4 active:opacity-70 ${primary ? "bg-primary dark:bg-primary-dark" : tonal}`}
        >
          <Text className={`text-[15px] font-semibold ${primary ? "text-on-primary dark:text-on-primary-dark" : tonalText}`}>{t("mobileWork.jobDetail.markComplete")}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A photo the server has, or one still on the phone (`localUri`, shown with "Waiting"). */
export type TilePhoto = { kind: "sent"; photo: JobPhoto } | { kind: "waiting"; key: string; localUri: string; createdAt: string };

export function tileKey(tile: TilePhoto): string {
  return tile.kind === "sent" ? tile.photo.id : tile.key;
}

export function PhotoTile({ tile, overlay, size }: { tile: TilePhoto; overlay?: string; size?: number }) {
  const t = useT();
  const sent = useFileUri(tile.kind === "sent" ? tile.photo.fileId : "");
  const ink = useCameraInk();
  const waiting = tile.kind === "waiting";
  const uri = tile.kind === "sent" ? sent : tile.localUri;
  return (
    <View testID={waiting ? "photo-waiting" : undefined} className="overflow-hidden rounded-md bg-surface-sunken dark:bg-surface-sunken-dark" style={size ? { width: size, height: size } : { flex: 1, aspectRatio: 1 }}>
      <Image
        source={uri ? { uri } : undefined}
        accessibilityLabel={tile.kind === "sent" ? (tile.photo.caption ?? t("mobileWork.jobDetail.sitePhoto")) : t("mobileWork.jobDetail.sitePhotoWaiting")}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      {overlay ? (
        // "+9" over the last tile: a dark veil with light text in both themes (the camera's ink, US-MOB-20).
        <View className="absolute inset-0 items-center justify-center">
          <View className="absolute inset-0" style={{ backgroundColor: ink.base, opacity: 0.6 }} />
          <Text className="text-[17px] font-semibold" style={{ color: ink.ink }}>
            {overlay}
          </Text>
        </View>
      ) : null}
      {waiting ? (
        <View className="absolute bottom-2 left-2 rounded-full bg-due-soon-bg px-2 py-0.5 dark:bg-due-soon-bg-dark">
          <Text className="text-[12px] font-medium text-due-soon dark:text-due-soon-dark">{t("mobileWork.jobDetail.waiting")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function QuoteRow({ quote, first, locale, onPresent }: { quote: QuoteToPresent; first: boolean; locale: string; onPresent: () => void }) {
  const t = useT();
  const colors = useNativeColors();
  const title = [quote.number, quote.title].filter(Boolean).join(" · ");
  return (
    <View testID={`quote-${quote.id}`} className={`flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-border dark:border-border-dark"}`}>
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-info-bg dark:bg-info-bg-dark">
        <FileText size={20} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{title}</Text>
        <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {quote.sentAt ? t("mobileWork.jobDetail.quoteSentWaiting", { date: dayMonth(new Date(quote.sentAt), locale) }) : t("mobileWork.jobDetail.quoteWaiting")}
        </Text>
      </View>
      <PillButton testID={`quote-present-${quote.id}`} label={t("mobileWork.jobDetail.present")} accessibilityLabel={t("mobileWork.jobDetail.presentQuote", { number: quote.number ?? t("mobileWork.common.quote") })} onPress={onPresent} />
    </View>
  );
}

/** An iOS grouped card or Android's outlined card. */
function Group({ children, testID, list = false }: { children: React.ReactNode; testID?: string; list?: boolean }) {
  // US-MOB-20 · `MobJobDetailAndroid`: Android draws the site and contact as an outlined card and lists without a card.
  const android = Platform.OS === "android";
  const surface = !android
    ? "overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
    : list
      ? "-mx-3"
      : "overflow-hidden rounded-2xl border border-outline-variant dark:border-outline-variant-dark";
  return (
    <View testID={testID} className={surface}>
      {children}
    </View>
  );
}

/**
 * US-MOB-05 · `MobJobDetail` (and Android) — a job on site: status, name,
 * "<job number> · <customer>", the site address with "Directions", who to
 * call, MILESTONES, PHOTOS · <n> with "See all" and QUOTES TO PRESENT.
 * "Add photos" is the camera in the toolbar on iOS and a floating button
 * on Android. No contract value, milestone amounts or invoices (D-048):
 * the API never sends them to Field.
 */
export function JobDetailScreen({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  // US-MOB-16/18: Present opens the quote live; offline, Android says so over the job (iOS shows it full screen).
  const present = (quoteId: string) => {
    if (Platform.OS === "android" && !connectivity.get()) {
      alertNeedsConnection(() => present(quoteId));
      return;
    }
    router.push({ pathname: "/quote/[id]", params: { id: quoteId, jobId: id } });
  };
  const colors = useNativeColors();
  const { locale } = useBusinessFormat();
  const listed = useAssignedJobs(false).data?.find((job) => job.id === id) ?? null;
  const detail = useCachedQuery<FieldJob>(jobKey(id), `/jobs/${id}`);
  const forThisJob = (item: OutboxItem) => item.kind !== "expense" && item.payload.jobId === id;
  const milestones = useCachedQuery<FieldMilestone[]>(milestonesKey(id), `/jobs/${id}/milestones`, { refreshOnSent: (item) => forThisJob(item) && item.kind === "completion" });
  const photos = useCachedQuery<JobPhoto[]>(photosKey(id), `/jobs/${id}/photos`, { refreshOnSent: forThisJob });
  const quotes = useCachedQuery<QuoteToPresent[]>(quotesKey(id), `/jobs/${id}/quotes`);
  const job = detail.data ?? listed;
  const waiting = jobWaiting(useOutboxItems(), id);
  const android = Platform.OS === "android";

  const refreshing = detail.refreshing || milestones.refreshing || photos.refreshing || quotes.refreshing;
  const onRefresh = useCallback(async () => {
    await Promise.all([detail.refresh(), milestones.refresh(), photos.refresh(), quotes.refresh()]);
  }, [detail, milestones, photos, quotes]);
  const addPhotos = () => router.push(`/camera?mode=photos&jobId=${id}`);

  const header = (
    <Stack.Screen
      options={
        android
          ? { title: job?.name ?? "" }
          : {
              title: "",
              unstable_headerRightItems: () => [{ type: "button" as const, label: t("mobileWork.common.addPhotos"), icon: { type: "sfSymbol" as const, name: "camera" as const }, accessibilityLabel: t("mobileWork.common.addPhotos"), onPress: addPhotos }],
            }
      }
    />
  );

  if (!job) {
    const gone = detail.status === "error" || (detail.status === "ready" && !detail.data);
    return (
      <View className="flex-1 bg-background p-4 dark:bg-background-dark">
        {header}
        {gone ? (
          <EmptyState title={t("mobileWork.jobDetail.notOnListTitle")} description={t("mobileWork.jobDetail.notOnListDescription")} />
        ) : (
          <View className="gap-5 pt-24">
            <HeadingSkeleton label={t("mobileWork.jobDetail.loadingJob")} />
            <CardRowsSkeleton rows={2} label={t("mobileWork.jobDetail.loadingSite")} />
            <ListRowsSkeleton label={t("mobileWork.jobDetail.loadingMilestones")} rows={3} trailing="pill" grouped />
          </View>
        )}
      </View>
    );
  }

  const pending = (milestones.data ?? []).filter((m) => m.status === "pending");
  const ordered = [...(milestones.data ?? [])].sort((a, b) => a.sequence - b.sequence);
  const photoList: TilePhoto[] = [
    ...waiting.photos.map(({ photo, queuedAt }) => ({ kind: "waiting" as const, key: photo.uri, localUri: photo.uri, createdAt: new Date(queuedAt).toISOString() })).reverse(),
    ...(photos.data ?? []).map((photo) => ({ kind: "sent" as const, photo })),
  ];
  const contact = job.siteContact;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {header}
      <ScrollView
        testID="job-detail"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 px-4 pb-32 pt-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurfaceMuted} />}
      >
        {android ? (
          <View className="flex-row items-center justify-between gap-2">
            <Text testID="job-subtitle" className="flex-1 text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{jobSubtitle(job)}</Text>
            <JobStatusChip status={job.status} />
          </View>
        ) : (
          <View className="gap-1.5">
            <JobStatusChip status={job.status} />
            <Text accessibilityRole="header" className="text-[28px] font-bold text-on-surface dark:text-on-surface-dark">{job.name}</Text>
            <Text testID="job-subtitle" className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{jobSubtitle(job)}</Text>
          </View>
        )}

        {job.siteAddress || contact ? (
          <Group testID="job-site">
            {job.siteAddress ? (
              <View className="flex-row items-center gap-3 px-4 py-3">
                <MapPin size={20} color={colors.onSurfaceMuted} />
                <Text className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark">{oneLine(job.siteAddress)}</Text>
                {android ? (
                  <Pressable onPress={() => void openDirections(job.siteAddress!)} accessibilityRole="button" accessibilityLabel={t("mobileWork.common.directionsTo", { address: oneLine(job.siteAddress) })} className="min-h-[44px] justify-center px-2">
                    <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">{t("mobileWork.common.directions")}</Text>
                  </Pressable>
                ) : (
                  <PillButton testID="job-directions" label={t("mobileWork.common.directions")} icon={Navigation} accessibilityLabel={t("mobileWork.common.directionsTo", { address: oneLine(job.siteAddress) })} onPress={() => void openDirections(job.siteAddress!)} />
                )}
              </View>
            ) : null}
            {contact ? (
              <View className={`flex-row items-center gap-3 px-4 py-3 ${job.siteAddress ? "border-t border-border dark:border-border-dark" : ""}`}>
                <Avatar fallback={initials({ name: contact.name, email: "?" })} size="lg" />
                <View className="flex-1 gap-0.5">
                  <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{contact.name}</Text>
                  {contact.title ? <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{contact.title}</Text> : null}
                </View>
                {contact.phone ? (
                  <Pressable
                    testID="job-call"
                    onPress={() => void callNumber(contact.phone!)}
                    accessibilityRole="button"
                    accessibilityLabel={t("mobileWork.common.callName", { name: contact.name })}
                    className="h-11 w-11 items-center justify-center rounded-full bg-paid-bg active:opacity-70 dark:bg-paid-bg-dark"
                  >
                    <Phone size={20} color={colors.paid} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Group>
        ) : null}

        <View className="gap-2">
          <SectionHeader title={t("mobileWork.jobDetail.milestones")} testID="job-milestones-header" />
          {ordered.length ? (
            <Group testID="job-milestones" list>
              {ordered.map((milestone, index) => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone}
                  first={index === 0}
                  primary={milestone.id === pending.find((m) => !waiting.completionMilestoneIds.includes(m.id))?.id}
                  locale={locale}
                  waiting={milestone.status === "pending" && waiting.completionMilestoneIds.includes(milestone.id)}
                  onComplete={() => router.push(`/milestone-complete?jobId=${id}&milestoneId=${milestone.id}`)}
                />
              ))}
            </Group>
          ) : milestones.loading ? (
            <ListRowsSkeleton label={t("mobileWork.jobDetail.loadingMilestones")} testID="skeleton-milestones" rows={3} trailing="pill" grouped />
          ) : (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.jobDetail.noMilestones")}</Text>
          )}
        </View>

        <View className="gap-2">
          <SectionHeader
            title={t("mobileWork.common.photos")}
            count={photos.loading && !waiting.photos.length ? undefined : photoList.length}
            testID="job-photos-header"
            action={photoList.length ? { label: t("mobileWork.jobDetail.seeAll"), onPress: () => router.push(`/jobs/${id}/photos`) } : undefined}
          />
          {photoList.length ? (
            <View className="flex-row gap-1">
              {photoList.slice(0, PREVIEW_PHOTOS).map((tile, index) => (
                <PhotoTile key={tileKey(tile)} tile={tile} overlay={index === PREVIEW_PHOTOS - 1 && photoList.length > PREVIEW_PHOTOS ? `+${photoList.length - PREVIEW_PHOTOS + 1}` : undefined} />
              ))}
              {Array.from({ length: Math.max(0, PREVIEW_PHOTOS - photoList.length) }).map((_, index) => (
                <View key={`empty-${index}`} style={{ flex: 1, aspectRatio: 1 }} />
              ))}
            </View>
          ) : photos.loading ? (
            <PhotoGridSkeleton />
          ) : (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.jobDetail.noPhotos")}</Text>
          )}
        </View>

        <View className="gap-2">
          <SectionHeader title={t("mobileWork.jobDetail.quotesToPresent")} testID="job-quotes-header" />
          {(quotes.data ?? []).length ? (
            <Group testID="job-quotes" list>
              {quotes.data!.map((quote, index) => (
                <QuoteRow key={quote.id} quote={quote} first={index === 0} locale={locale} onPresent={() => present(quote.id)} />
              ))}
            </Group>
          ) : quotes.loading ? (
            <ListRowsSkeleton label={t("mobileWork.jobDetail.loadingQuotes")} testID="skeleton-quotes" rows={1} leading trailing="pill" grouped />
          ) : (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.jobDetail.nothingWaiting")}</Text>
          )}
        </View>
      </ScrollView>
      {android ? (
        <Fab testID="job-add-photos" label={t("mobileWork.common.addPhotos")} icon={Camera} onPress={addPhotos} />
      ) : null}
    </View>
  );
}
