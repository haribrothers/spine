import { useMemo } from "react";
import { Platform, SectionList, Text, View, useWindowDimensions } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import { EmptyState } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { jobKey, photosKey, useAssignedJobs, type FieldJob, type JobPhoto } from "../../lib/data/jobs";
import { useBusinessFormat } from "../../lib/data/business";
import { daysUntil, weekdayDayMonth } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { PhotoTile, tileKey, type TilePhoto } from "./job-detail-screen";
import { useOutboxItems } from "../../lib/outbox/pending";
import { jobWaiting } from "../../lib/outbox/job-waiting";
import { PhotoGridSkeleton } from "../../components/skeletons";
import { Fab } from "../../components/fab";
import { t as translate, useT } from "../../lib/i18n";

const COLUMNS = 3;
const GAP = 2;

const takenAt = (tile: TilePhoto) => (tile.kind === "sent" ? tile.photo.createdAt : tile.createdAt);

/** Photos grouped by the day they were taken, newest first: "Today", "Mon 5 Oct", … Waiting photos are today's. */
export function photosByDay(photos: (JobPhoto | TilePhoto)[], locale: string, now: Date = new Date()): { title: string; data: TilePhoto[][] }[] {
  const tiles: TilePhoto[] = photos.map((p) => ("kind" in p ? p : { kind: "sent" as const, photo: p }));
  const groups = new Map<string, TilePhoto[]>();
  for (const photo of [...tiles].sort((a, b) => Date.parse(takenAt(b)) - Date.parse(takenAt(a)))) {
    const at = new Date(takenAt(photo));
    const days = daysUntil(at, now);
    const title = days === 0 ? translate("mobileWork.jobPhotos.today") : days === -1 ? translate("mobileWork.jobPhotos.yesterday") : weekdayDayMonth(at, locale);
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
  const t = useT();
  const router = useRouter();
  const { locale } = useBusinessFormat();
  const { width } = useWindowDimensions();
  const listed = useAssignedJobs(false).data?.find((job) => job.id === id) ?? null;
  const detail = useCachedQuery<FieldJob>(jobKey(id), `/jobs/${id}`);
  const photos = useCachedQuery<JobPhoto[]>(photosKey(id), `/jobs/${id}/photos`, { refreshOnSent: (item) => item.kind !== "expense" && item.payload.jobId === id });
  const job = detail.data ?? listed;
  const queued = useOutboxItems();
  const list = useMemo<TilePhoto[]>(
    () => [
      ...jobWaiting(queued, id).photos.map(({ photo, queuedAt, itemId }) => ({ kind: "waiting" as const, key: photo.uri, localUri: photo.uri, createdAt: new Date(queuedAt).toISOString(), itemId, caption: photo.caption ?? null })),
      ...(photos.data ?? []).map((photo) => ({ kind: "sent" as const, photo })),
    ],
    [queued, id, photos.data],
  );
  const sections = useMemo(() => photosByDay(list, locale), [list, locale]);
  const tile = Math.floor((width - 32 - GAP * (COLUMNS - 1)) / COLUMNS);
  const android = Platform.OS === "android";
  const subtitle = [job?.name, job?.number].filter(Boolean).join(" · ");
  const addPhotos = () => router.push(`/camera?mode=photos&jobId=${id}`);
  const title = photos.loading ? t("mobileWork.common.photos") : t("mobileWork.jobPhotos.titleCount", { n: list.length });

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Stack.Screen
        options={
          android
            ? {
                headerTitle: () => (
                  <View>
                    <Text className="text-[22px] text-on-surface dark:text-on-surface-dark">{title}</Text>
                    <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>
                  </View>
                ),
              }
            : {
                title,
                unstable_headerRightItems: () => [{ type: "button" as const, label: t("mobileWork.common.addPhotos"), icon: { type: "sfSymbol" as const, name: "camera" as const }, accessibilityLabel: t("mobileWork.common.addPhotos"), onPress: addPhotos }],
              }
        }
      />
      <SectionList
        testID="job-photos"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pb-32"
        sections={sections}
        keyExtractor={(row) => row.map(tileKey).join(",")}
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
              <PhotoTile key={tileKey(photo)} tile={photo} size={tile} onPress={() => router.push(`/photo-viewer?jobId=${id}&key=${encodeURIComponent(tileKey(photo))}`)} />
            ))}
          </View>
        )}
        ListEmptyComponent={
          photos.loading ? (
            <View className="pt-5">
              <PhotoGridSkeleton rows={4} columns={COLUMNS} size={tile} gap={GAP} />
            </View>
          ) : photos.data ? (
            <EmptyState title={t("mobileWork.jobPhotos.emptyTitle")} description={t("mobileWork.jobPhotos.emptyDescription")} />
          ) : null
        }
      />
      {android ? (
        <Fab testID="photos-add" label={t("mobileWork.common.addPhotos")} icon={Camera} onPress={addPhotos} />
      ) : null}
    </View>
  );
}
