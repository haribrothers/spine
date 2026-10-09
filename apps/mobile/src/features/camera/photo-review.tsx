import { useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { FloatingLabelField, FormRow, FormSection, FullWidthButton, OutlinedTextField, SelectListField, useNativeColors } from "@spine/ui-native";
import { outbox } from "../../lib/outbox/outbox";
import type { LocalPhoto } from "../../lib/outbox/types";
import { milestonesKey, useAssignedJobs, type FieldMilestone } from "../../lib/data/jobs";
import { useCachedQuery } from "../../lib/data/use-cached-query";

export const REVIEW_NOTE = "Photos upload in the background. You can keep working — check progress from the sync pill on Today.";
const NO_MILESTONE = "none";

/** "Save 2 photos". */
export function saveLabel(count: number): string {
  return `Save ${count} ${count === 1 ? "photo" : "photos"}`;
}

/**
 * US-MOB-11 · `MobPhotoReview` (and Android) — after "Done": each photo
 * large with the strip below ("+" takes more), a caption per photo, the
 * job (changeable), an optional milestone, and "Save <n> photos", which
 * puts them in the outbox: they send when there's signal.
 */
export function PhotoReview({
  photos,
  jobId,
  onJobChange,
  onPhotosChange,
  onAddMore,
  onSaved,
  onClose,
}: {
  photos: LocalPhoto[];
  jobId: string | null;
  onJobChange: (id: string) => void;
  onPhotosChange: (photos: LocalPhoto[]) => void;
  onAddMore: () => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const android = Platform.OS === "android";
  const jobs = useAssignedJobs(false).data ?? [];
  const job = jobs.find((j) => j.id === jobId) ?? null;
  const milestones = useCachedQuery<FieldMilestone[]>(milestonesKey(jobId ?? "none"), `/jobs/${jobId}/milestones`, { enabled: Boolean(jobId) });
  const pending = useMemo(() => (milestones.data ?? []).filter((m) => m.status === "pending"), [milestones.data]);
  const [selected, setSelected] = useState(0);
  const [milestoneId, setMilestoneId] = useState<string>(NO_MILESTONE);
  const [saving, setSaving] = useState(false);
  const current = photos[Math.min(selected, photos.length - 1)];

  const setCaption = (caption: string) => onPhotosChange(photos.map((p, i) => (i === selected ? { ...p, caption } : p)));
  const retake = () => {
    if (current) outbox.discardPhoto(current);
    onPhotosChange(photos.filter((_, i) => i !== selected));
    setSelected(0);
    onAddMore();
  };
  const save = async () => {
    if (!job || saving || !photos.length) return;
    setSaving(true);
    await outbox.addPhotos({ jobId: job.id, jobName: job.name, milestoneId: milestoneId === NO_MILESTONE ? null : milestoneId, photos: photos.map((p) => ({ ...p, caption: p.caption?.trim() || null })) });
    onSaved();
  };

  const jobField = {
    floatingLabel: "Job",
    placeholder: "Choose a job",
    sheetTitle: "Job",
    value: jobId,
    options: jobs.map((j) => ({ label: j.name, value: j.id })),
    onValueChange: (id: string) => {
      onJobChange(id);
      setMilestoneId(NO_MILESTONE);
    },
  };
  const milestoneField = {
    floatingLabel: "Milestone (optional)",
    sheetTitle: "Milestone",
    value: milestoneId,
    options: [{ label: "No milestone", value: NO_MILESTONE }, ...pending.map((m) => ({ label: m.name, value: m.id }))],
    onValueChange: setMilestoneId,
  };

  const title = `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`;
  return (
    <View testID="photo-review" className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2">
        {android ? (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} className="h-11 w-11 justify-center">
            <X size={24} color={colors.onSurface} />
          </Pressable>
        ) : (
          <Pressable testID="review-retake" onPress={retake} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full bg-surface px-4 dark:bg-surface-dark">
            <Text className="text-[16px] text-on-surface dark:text-on-surface-dark">Retake</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" className={`text-[18px] font-semibold text-on-surface dark:text-on-surface-dark ${android ? "flex-1 pl-2" : ""}`}>
          {title}
        </Text>
        {android ? (
          <Pressable testID="review-save" onPress={() => void save()} disabled={!job || saving} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full bg-primary px-5 dark:bg-primary-dark">
            <Text className="text-[15px] font-semibold text-on-primary dark:text-on-primary-dark">Save</Text>
          </Pressable>
        ) : (
          <View className="w-[84px]" />
        )}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-4 px-4 pb-32">
        {current ? <Image testID="review-photo" source={{ uri: current.uri }} accessibilityLabel={`Photo ${selected + 1} of ${photos.length}`} className="h-[300px] w-full rounded-2xl" resizeMode="cover" /> : null}
        <View className="flex-row flex-wrap gap-2">
          {photos.map((p, i) => (
            <Pressable
              key={p.uri}
              testID={`review-thumb-${i}`}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1}`}
              accessibilityState={{ selected: i === selected }}
              className={`overflow-hidden rounded-lg ${i === selected ? "border-2 border-primary dark:border-primary-dark" : ""}`}
            >
              <Image source={{ uri: p.uri }} className="h-14 w-14" />
            </Pressable>
          ))}
          <Pressable testID="review-add" onPress={onAddMore} accessibilityRole="button" accessibilityLabel="Take more photos" className="h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border-strong dark:border-border-strong-dark">
            <Plus size={22} color={colors.primary} />
          </Pressable>
        </View>
        {android ? (
          // `MobPhotoReviewAndroid`: Material outlined fields, no grouped card.
          <View className="gap-4">
            <OutlinedTextField testID="review-caption" label="Caption" placeholder="What does this photo show?" value={current?.caption ?? ""} onChangeText={setCaption} />
            <SelectListField testID="review-job" variant="outlined" {...jobField} />
            <SelectListField testID="review-milestone" variant="outlined" {...milestoneField} />
          </View>
        ) : (
          <FormSection>
            <FormRow>
              <FloatingLabelField testID="review-caption" label="Caption" value={current?.caption ?? ""} onChangeText={setCaption} />
            </FormRow>
            <FormRow>
              <SelectListField testID="review-job" variant="row" {...jobField} />
            </FormRow>
            <FormRow last>
              <SelectListField testID="review-milestone" variant="row" {...milestoneField} />
            </FormRow>
          </FormSection>
        )}
        <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{REVIEW_NOTE}</Text>
      </ScrollView>
      {android ? null : (
        <View className="absolute bottom-0 left-0 right-0 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
          <FullWidthButton testID="review-save" label={saveLabel(photos.length)} onPress={() => void save()} disabled={!job || saving} />
        </View>
      )}
    </View>
  );
}
