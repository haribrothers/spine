import { useCallback } from "react";
import { Image, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import CircleCheck from "lucide-react-native/icons/circle-check";
import FileText from "lucide-react-native/icons/file-text";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import Phone from "lucide-react-native/icons/phone";
import { Avatar, EmptyState, Skeleton, useNativeColors } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { jobKey, milestonesKey, photosKey, quotesKey, useAssignedJobs, type FieldJob, type FieldMilestone, type JobPhoto, type QuoteToPresent } from "../../lib/data/jobs";
import { useBusinessFormat } from "../../lib/data/business";
import { useFileSource } from "../../lib/data/files";
import { calendarDay, dayMonth, daysUntil, oneLine, weekdayDayMonth } from "../../lib/format";
import { initials } from "../../lib/member-display";
import { callNumber, openDirections } from "../../lib/linking";
import { arrivesLater } from "../../lib/later";
import { PillButton } from "../../components/pill-button";
import { SectionHeader } from "../../components/section-header";
import { JobStatusChip } from "./job-status";

const PREVIEW_PHOTOS = 4;

export function jobSubtitle(job: Pick<FieldJob, "number" | "contactName">): string {
  return [job.number, job.contactName].filter(Boolean).join(" · ");
}

function MilestoneRow({ milestone, primary, first, locale }: { milestone: FieldMilestone; primary: boolean; first: boolean; locale: string }) {
  const colors = useNativeColors();
  const done = milestone.status !== "pending";
  const due = milestone.dueDate ? calendarDay(milestone.dueDate) : null;
  const days = due ? daysUntil(due) : null;
  const dueClass = days === null ? "text-on-surface-muted dark:text-on-surface-muted-dark" : days < 0 ? "text-overdue dark:text-overdue-dark" : days < 7 ? "text-due-soon dark:text-due-soon-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark";
  return (
    <View testID={`milestone-${milestone.id}`} className={`flex-row items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-border dark:border-border-dark"}`}>
      <View className="flex-1 gap-0.5">
        <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{milestone.name}</Text>
        {done ? (
          <Text className="text-[14px] text-paid dark:text-paid-dark">Completed{milestone.completedAt ? ` ${dayMonth(new Date(milestone.completedAt), locale)}` : ""}</Text>
        ) : due ? (
          <Text className={`text-[14px] ${dueClass}`}>Due {weekdayDayMonth(due, locale)}</Text>
        ) : (
          <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">No due date</Text>
        )}
      </View>
      {done ? (
        <View accessible accessibilityLabel="Completed" className="flex-row items-center gap-1.5">
          <CircleCheck size={20} color={colors.paid} />
          <Text className="text-[15px] font-medium text-paid dark:text-paid-dark">Completed</Text>
        </View>
      ) : (
        <Pressable
          testID={`milestone-complete-${milestone.id}`}
          onPress={() => arrivesLater("Mark complete")}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${milestone.name} complete`}
          className={`min-h-[44px] items-center justify-center rounded-full px-4 active:opacity-70 ${primary ? "bg-primary dark:bg-primary-dark" : "bg-info-bg dark:bg-info-bg-dark"}`}
        >
          <Text className={`text-[15px] font-semibold ${primary ? "text-on-primary dark:text-on-primary-dark" : "text-primary dark:text-primary-dark"}`}>Mark complete</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PhotoTile({ photo, overlay, size, waiting = false }: { photo: JobPhoto; overlay?: string; size?: number; waiting?: boolean }) {
  const source = useFileSource();
  return (
    <View className="overflow-hidden rounded-md bg-surface-sunken dark:bg-surface-sunken-dark" style={size ? { width: size, height: size } : { flex: 1, aspectRatio: 1 }}>
      <Image source={source(photo.fileId)} accessibilityLabel={photo.caption ?? "Site photo"} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      {overlay ? (
        <View className="absolute inset-0 items-center justify-center bg-on-surface/60 dark:bg-on-surface-dark/60">
          <Text className="text-[17px] font-semibold text-surface dark:text-surface-dark">{overlay}</Text>
        </View>
      ) : null}
      {waiting ? (
        <View className="absolute bottom-2 left-2 rounded-full bg-due-soon-bg px-2 py-0.5 dark:bg-due-soon-bg-dark">
          <Text className="text-[12px] font-medium text-due-soon dark:text-due-soon-dark">Waiting</Text>
        </View>
      ) : null}
    </View>
  );
}

function QuoteRow({ quote, first, locale }: { quote: QuoteToPresent; first: boolean; locale: string }) {
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
          {quote.sentAt ? `Sent ${dayMonth(new Date(quote.sentAt), locale)} · ` : ""}waiting for the customer
        </Text>
      </View>
      <PillButton testID={`quote-present-${quote.id}`} label="Present" accessibilityLabel={`Present ${quote.number ?? "quote"}`} onPress={() => arrivesLater("Present")} />
    </View>
  );
}

/** An iOS grouped card or Android's outlined card. */
function Group({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
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
  const router = useRouter();
  const colors = useNativeColors();
  const { locale } = useBusinessFormat();
  const listed = useAssignedJobs(false).data?.find((job) => job.id === id) ?? null;
  const detail = useCachedQuery<FieldJob>(jobKey(id), `/jobs/${id}`);
  const milestones = useCachedQuery<FieldMilestone[]>(milestonesKey(id), `/jobs/${id}/milestones`);
  const photos = useCachedQuery<JobPhoto[]>(photosKey(id), `/jobs/${id}/photos`);
  const quotes = useCachedQuery<QuoteToPresent[]>(quotesKey(id), `/jobs/${id}/quotes`);
  const job = detail.data ?? listed;
  const android = Platform.OS === "android";

  const refreshing = detail.refreshing || milestones.refreshing || photos.refreshing || quotes.refreshing;
  const onRefresh = useCallback(async () => {
    await Promise.all([detail.refresh(), milestones.refresh(), photos.refresh(), quotes.refresh()]);
  }, [detail, milestones, photos, quotes]);
  const addPhotos = () => arrivesLater("Add photos");

  const header = (
    <Stack.Screen
      options={
        android
          ? { title: job?.name ?? "" }
          : {
              title: "",
              unstable_headerRightItems: () => [{ type: "button" as const, label: "Add photos", icon: { type: "sfSymbol" as const, name: "camera" as const }, accessibilityLabel: "Add photos", onPress: addPhotos }],
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
          <EmptyState title="This job isn't on your list" description="Your office may have taken you off its crew. Pull down on Jobs to refresh." />
        ) : (
          <View className="gap-3 pt-24">
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </View>
        )}
      </View>
    );
  }

  const pending = (milestones.data ?? []).filter((m) => m.status === "pending");
  const ordered = [...(milestones.data ?? [])].sort((a, b) => a.sequence - b.sequence);
  const photoList = photos.data ?? [];
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
                  <Pressable onPress={() => void openDirections(job.siteAddress!)} accessibilityRole="button" accessibilityLabel={`Directions to ${oneLine(job.siteAddress)}`} className="min-h-[44px] justify-center px-2">
                    <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Directions</Text>
                  </Pressable>
                ) : (
                  <PillButton testID="job-directions" label="Directions" icon={Navigation} accessibilityLabel={`Directions to ${oneLine(job.siteAddress)}`} onPress={() => void openDirections(job.siteAddress!)} />
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
                    accessibilityLabel={`Call ${contact.name}`}
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
          <SectionHeader title="Milestones" testID="job-milestones-header" />
          {ordered.length ? (
            <Group testID="job-milestones">
              {ordered.map((milestone, index) => (
                <MilestoneRow key={milestone.id} milestone={milestone} first={index === 0} primary={milestone.id === pending[0]?.id} locale={locale} />
              ))}
            </Group>
          ) : milestones.data ? (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">No milestones on this job yet.</Text>
          ) : (
            <Skeleton className="h-24 w-full rounded-2xl" />
          )}
        </View>

        <View className="gap-2">
          <SectionHeader
            title="Photos"
            count={photoList.length}
            testID="job-photos-header"
            action={photoList.length ? { label: "See all", onPress: () => router.push(`/jobs/${id}/photos`) } : undefined}
          />
          {photoList.length ? (
            <View className="flex-row gap-1">
              {photoList.slice(0, PREVIEW_PHOTOS).map((photo, index) => (
                <PhotoTile key={photo.id} photo={photo} overlay={index === PREVIEW_PHOTOS - 1 && photoList.length > PREVIEW_PHOTOS ? `+${photoList.length - PREVIEW_PHOTOS + 1}` : undefined} />
              ))}
              {Array.from({ length: Math.max(0, PREVIEW_PHOTOS - photoList.length) }).map((_, index) => (
                <View key={`empty-${index}`} style={{ flex: 1, aspectRatio: 1 }} />
              ))}
            </View>
          ) : (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">No photos yet.</Text>
          )}
        </View>

        <View className="gap-2">
          <SectionHeader title="Quotes to present" testID="job-quotes-header" />
          {(quotes.data ?? []).length ? (
            <Group testID="job-quotes">
              {quotes.data!.map((quote, index) => (
                <QuoteRow key={quote.id} quote={quote} first={index === 0} locale={locale} />
              ))}
            </Group>
          ) : (
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">Nothing waiting for the customer.</Text>
          )}
        </View>
      </ScrollView>
      {android ? (
        <Pressable
          testID="job-add-photos"
          onPress={addPhotos}
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          className="absolute bottom-6 right-4 h-14 flex-row items-center gap-3 rounded-2xl bg-info-bg px-5 shadow-md active:opacity-80 dark:bg-info-bg-dark"
        >
          <Camera size={22} color={colors.primary} />
          <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Add photos</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
