import { useMemo } from "react";
import { Platform, Pressable, SectionList, Text, View, useWindowDimensions } from "react-native";
import { Stack } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { jobKey, photosKey, useAssignedJobs, type FieldJob, type JobPhoto } from "../../lib/data/jobs";
import { useBusinessFormat } from "../../lib/data/business";
import { daysUntil, weekdayDayMonth } from "../../lib/format";
import { arrivesLater } from "../../lib/later";
import { SectionHeader } from "../../components/section-header";
import { PhotoTile } from "./job-detail-screen";

const COLUMNS = 3;
const GAP = 2;

/** Photos grouped by the day they were taken, newest first: "Today", "Mon 5 Oct", … */
export function photosByDay(photos: JobPhoto[], locale: string, now: Date = new Date()): { title: string; data: JobPhoto[][] }[] {
  const groups = new Map<string, JobPhoto[]>();
  for (const photo of [...photos].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
    const at = new Date(photo.createdAt);
    const days = daysUntil(at, now);
    const title = days === 0 ? "Today" : days === -1 ? "Yesterday" : weekdayDayMonth(at, locale);
    groups.set(title, [...(groups.get(title) ?? []), photo]);
  }
  return [...groups.entries()].map(([title, list]) => ({
    title,
    data: Array.from({ length: Math.ceil(list.length / COLUMNS) }, (_, row) => list.slice(row * COLUMNS, row * COLUMNS + COLUMNS)),
  }));
}

/**
 * US-MOB-05 · `MobJobPhotos` (and Android) — "Photos · <n>" with the job's
 * name and number, grouped by day newest first. Photos still in the outbox
 * carry "Waiting" (offline sync, Group 3); "Add photos" is the toolbar
 * camera on iOS and a floating button on Android.
 */
export function JobPhotosScreen({ id }: { id: string }) {
  const colors = useNativeColors();
  const { locale } = useBusinessFormat();
  const { width } = useWindowDimensions();
  const listed = useAssignedJobs(false).data?.find((job) => job.id === id) ?? null;
  const detail = useCachedQuery<FieldJob>(jobKey(id), `/jobs/${id}`);
  const photos = useCachedQuery<JobPhoto[]>(photosKey(id), `/jobs/${id}/photos`);
  const job = detail.data ?? listed;
  const list = useMemo(() => photos.data ?? [], [photos.data]);
  const sections = useMemo(() => photosByDay(list, locale), [list, locale]);
  const tile = Math.floor((width - 32 - GAP * (COLUMNS - 1)) / COLUMNS);
  const android = Platform.OS === "android";
  const subtitle = [job?.name, job?.number].filter(Boolean).join(" · ");
  const addPhotos = () => arrivesLater("Add photos");

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Stack.Screen
        options={
          android
            ? {
                headerTitle: () => (
                  <View>
                    <Text className="text-[22px] text-on-surface dark:text-on-surface-dark">Photos · {list.length}</Text>
                    <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>
                  </View>
                ),
              }
            : {
                title: `Photos · ${list.length}`,
                unstable_headerRightItems: () => [{ type: "button" as const, label: "Add photos", icon: { type: "sfSymbol" as const, name: "camera" as const }, accessibilityLabel: "Add photos", onPress: addPhotos }],
              }
        }
      />
      <SectionList
        testID="job-photos"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pb-32"
        sections={sections}
        keyExtractor={(row) => row.map((p) => p.id).join(",")}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={android ? null : <Text className="pb-1 pt-2 text-center text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>}
        renderSectionHeader={({ section }) => (
          <View className="pb-2 pt-5">
            <SectionHeader title={section.title} />
          </View>
        )}
        renderItem={({ item: row }) => (
          <View className="flex-row" style={{ gap: GAP, marginBottom: GAP }}>
            {row.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} size={tile} />
            ))}
          </View>
        )}
        ListEmptyComponent={photos.data ? <EmptyState title="No photos yet" description="Photos your crew takes on this job show up here, newest first." /> : null}
      />
      {android ? (
        <Pressable
          testID="photos-add"
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
