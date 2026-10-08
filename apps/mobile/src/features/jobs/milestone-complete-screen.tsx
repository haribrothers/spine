import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { useNativeColors } from "@spine/ui-native";
import { outbox } from "../../lib/outbox/outbox";
import type { LocalPhoto } from "../../lib/outbox/types";
import { newIdempotencyKey } from "../../lib/api/idempotency";
import { useCameraResult } from "../../lib/camera/handoff";
import { jobKey, milestonesKey, useAssignedJobs, type FieldJob, type FieldMilestone } from "../../lib/data/jobs";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useBusinessFormat } from "../../lib/data/business";
import { calendarDay, weekdayDayMonth } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { useCameraInk } from "../camera/camera-screen";

export const COMPLETE_NOTE = "Your office is told straight away so they can bill this stage. No signal? It's saved and sent when you're back online.";

/**
 * US-MOB-15 · `MobMilestoneComplete` (and Android) — marks a milestone done
 * with photos of the finished work and a note for the office. It goes in
 * the outbox, so it works with no signal; the job shows "Completion
 * waiting" until it reaches the office, which is told then. If someone
 * completed it first, Sync says "Already completed by <name>".
 */
export function MilestoneCompleteScreen({ jobId, milestoneId }: { jobId: string; milestoneId: string }) {
  const router = useRouter();
  const colors = useNativeColors();
  const { ink } = useCameraInk();
  const { locale } = useBusinessFormat();
  const android = Platform.OS === "android";
  const listed = useAssignedJobs(false).data?.find((j) => j.id === jobId) ?? null;
  const job = useCachedQuery<FieldJob>(jobKey(jobId), `/jobs/${jobId}`, { enabled: false }).data ?? listed;
  const milestone = useCachedQuery<FieldMilestone[]>(milestonesKey(jobId), `/jobs/${jobId}/milestones`, { enabled: false }).data?.find((m) => m.id === milestoneId) ?? null;
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [request] = useState(newIdempotencyKey);
  useCameraResult(request, (taken) => setPhotos((prev) => [...prev, ...taken]));

  const cancel = () => {
    photos.forEach((p) => outbox.discardPhoto(p));
    router.back();
  };
  const complete = async () => {
    if (saving || !milestone) return;
    setSaving(true);
    await outbox.addCompletion({ jobId, jobName: job?.name ?? "", milestoneId, milestoneName: milestone.name, completionNotes: note.trim() || null, photos });
    router.back();
  };
  const subtitle = [job?.name, milestone?.dueDate ? `due ${weekdayDayMonth(calendarDay(milestone.dueDate), locale)}` : null].filter(Boolean).join(" · ");

  return (
    <ScrollView testID="milestone-complete" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-surface dark:bg-surface-dark" contentContainerClassName="gap-5 px-5 pb-12 pt-4">
      <Stack.Screen
        options={
          android
            ? { title: "Mark complete?" }
            : { title: "Mark complete", unstable_headerLeftItems: () => [{ type: "button" as const, label: "Cancel", onPress: cancel }] }
        }
      />
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-[22px] font-bold text-on-surface dark:text-on-surface-dark">{milestone?.name ?? ""}</Text>
        <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>
      </View>

      <View className="gap-2">
        <SectionHeader title="Photos of the finished work" />
        <View className="flex-row flex-wrap gap-2">
          {photos.map((photo) => (
            <View key={photo.uri} className="h-[84px] w-[84px] overflow-hidden rounded-lg">
              <Image source={{ uri: photo.uri }} accessibilityLabel="Photo of the finished work" className="h-full w-full" />
              <Pressable
                onPress={() => {
                  outbox.discardPhoto(photo);
                  setPhotos((prev) => prev.filter((p) => p.uri !== photo.uri));
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                hitSlop={10}
                className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.scrim }}
              >
                <X size={16} color={ink} />
              </Pressable>
            </View>
          ))}
          <Pressable
            testID="milestone-add-photo"
            onPress={() => router.push(`/camera?mode=milestone&jobId=${jobId}&request=${request}`)}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            className="h-[84px] w-[84px] items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong dark:border-border-strong-dark"
          >
            <Camera size={20} color={colors.primary} />
            <Text className="text-[13px] font-semibold text-primary dark:text-primary-dark">Add</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <SectionHeader title="Note for the office (optional)" />
        <TextInput
          testID="milestone-note"
          value={note}
          onChangeText={setNote}
          multiline
          accessibilityLabel="Note for the office (optional)"
          placeholder="What's done, anything they should know"
          placeholderTextColor={colors.onSurfaceMuted}
          className="min-h-[88px] rounded-xl border border-border-strong bg-background px-4 py-3 text-[16px] text-on-surface dark:border-border-strong-dark dark:bg-background-dark dark:text-on-surface-dark"
          style={{ textAlignVertical: "top" }}
        />
      </View>

      <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{COMPLETE_NOTE}</Text>
      <View className={`pt-2 ${android ? "flex-row items-center justify-end gap-6" : ""}`}>
        {android ? (
          <Pressable onPress={cancel} accessibilityRole="button" className="min-h-[48px] justify-center">
            <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="milestone-complete-submit"
          onPress={() => void complete()}
          disabled={saving || !milestone}
          accessibilityRole="button"
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80 dark:bg-primary-dark"
          style={{ opacity: saving || !milestone ? 0.6 : 1 }}
        >
          {android ? null : <Check size={20} color={colors.onPrimary} />}
          <Text className="text-[17px] font-semibold text-on-primary dark:text-on-primary-dark">Mark complete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
