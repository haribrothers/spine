import { FlatList, Platform, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Briefcase from "lucide-react-native/icons/briefcase";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { EmptyState, StatusChip, useNativeColors } from "@spine/ui-native";
import { useAssignedJobs, type FieldJob } from "../../lib/data/jobs";
import { useBusinessFormat } from "../../lib/data/business";
import { townFrom } from "../../lib/format";
import { PillButton } from "../../components/pill-button";
import { SectionHeader } from "../../components/section-header";
import { ServerErrorState } from "../errors/server-error-state";
import { jobMilestoneChip } from "./milestone-chip";

export const JOBS_EMPTY_TITLE = "No jobs assigned to you yet";
export const JOBS_EMPTY_MESSAGE = "When your office adds you to a job's crew, it shows up here with its address and contact.";
export const JOBS_FOOTNOTE = "Only jobs your office has put you on the crew for. Pull down to refresh.";

function JobRow({ job, first, onOpen }: { job: FieldJob; first: boolean; onOpen: () => void }) {
  const colors = useNativeColors();
  const { locale } = useBusinessFormat();
  const chip = jobMilestoneChip(job, locale);
  const subtitle = [job.contactName, townFrom(job.siteAddress)].filter(Boolean).join(" · ");
  const android = Platform.OS === "android";
  return (
    <Pressable
      testID={`job-row-${job.id}`}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={[job.name, subtitle, chip?.label].filter(Boolean).join(", ")}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-sunken dark:active:bg-surface-sunken-dark ${first ? "" : "border-t border-border dark:border-border-dark"}`}
    >
      {android ? (
        <View className={`h-11 w-11 items-center justify-center rounded-xl ${chip?.status === "paid" ? "bg-draft-bg dark:bg-draft-bg-dark" : "bg-info-bg dark:bg-info-bg-dark"}`}>
          <Briefcase size={20} color={chip?.status === "paid" ? colors.onSurfaceMuted : colors.primary} />
        </View>
      ) : null}
      <View className="flex-1 gap-1">
        <Text className={`text-[17px] text-on-surface dark:text-on-surface-dark ${android ? "" : "font-semibold"}`}>{job.name}</Text>
        {subtitle ? <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text> : null}
        {chip ? <StatusChip status={chip.status}>{chip.label}</StatusChip> : null}
      </View>
      {android ? null : <ChevronRight size={18} color={colors.onSurfaceMuted} />}
    </Pressable>
  );
}

/**
 * US-MOB-04 · `MobJobsList`, `MobJobsEmpty` (and Android) — every job I'm
 * on the crew of ("ASSIGNED TO YOU · <n>"), with customer, town and
 * milestone status. No search field: the Search tab finds jobs (US-MOB-23).
 * Pull to refresh; a job I'm taken off disappears with its cached copy
 * (US-JOB-16).
 */
export function JobsListScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const jobs = useAssignedJobs();
  const list = jobs.data ?? [];
  const android = Platform.OS === "android";

  if (jobs.status === "unreachable" && !jobs.data) {
    return (
      <View className="flex-1 justify-center bg-background p-4 dark:bg-background-dark">
        <ServerErrorState onRetry={() => void jobs.refresh()} />
      </View>
    );
  }

  return (
    <FlatList
      testID="jobs-list"
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-3 pb-32 pt-3"
      contentContainerStyle={list.length === 0 && jobs.data ? { flexGrow: 1, justifyContent: "center" } : undefined}
      data={list.length ? [list] : []}
      keyExtractor={() => "assigned"}
      refreshControl={<RefreshControl refreshing={jobs.refreshing} onRefresh={jobs.refresh} tintColor={colors.onSurfaceMuted} />}
      renderItem={({ item }) => (
        <View className="gap-2 px-4">
          <SectionHeader title="Assigned to you" count={item.length} testID="jobs-count" />
          <View className={android ? "-mx-4" : "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark"}>
            {item.map((job, index) => (
              <JobRow key={job.id} job={job} first={index === 0} onOpen={() => router.push(`/jobs/${job.id}`)} />
            ))}
          </View>
          <Text className="px-1 pt-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{JOBS_FOOTNOTE}</Text>
        </View>
      )}
      ListEmptyComponent={
        jobs.data ? (
          <EmptyState
            testID="jobs-empty"
            icon={
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-draft-bg dark:bg-draft-bg-dark">
                <Briefcase size={30} color={colors.onSurfaceMuted} />
              </View>
            }
            title={JOBS_EMPTY_TITLE}
            description={JOBS_EMPTY_MESSAGE}
            action={<PillButton testID="jobs-check-again" label="Check again" icon={RefreshCw} onPress={() => void jobs.refresh()} />}
          />
        ) : null
      }
    />
  );
}
