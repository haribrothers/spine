import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, Stack } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { StatusChip, useNativeColors, type StatusChipProps } from "@spine/ui-native";

const JOBS: { id: string; title: string; client: string; status: NonNullable<StatusChipProps["status"]> }[] = [
  { id: "1", title: "Kitchen extension", client: "Acme Contracting Ltd.", status: "paid" },
  { id: "2", title: "Roof repair", client: "Northside Builders", status: "due-soon" },
  { id: "3", title: "Bathroom remodel", client: "Coastal Renovations", status: "overdue" },
  { id: "4", title: "Deck installation", client: "Green Valley Homes", status: "draft" },
  { id: "5", title: "Fence replacement", client: "Acme Contracting Ltd.", status: "paid" },
];

/**
 * List half of the List + Detail template — a realistic Jobs-list shape,
 * pushing to `[jobId].tsx`. `Link` + `Pressable` (not `View`) — see
 * `components/index.tsx`'s own doc comment for why.
 */
export default function ListDetailIndexScreen() {
  const colors = useNativeColors();

  return (
    <>
      <Stack.Screen options={{ title: "Jobs" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="p-4 gap-2">
        {JOBS.map((job) => (
          <Link key={job.id} href={`/templates/list-detail/${job.id}`} asChild>
            <Pressable className="flex-row items-center justify-between rounded-lg border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark">
              <View className="flex-1 gap-1 pr-2">
                <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{job.title}</Text>
                <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{job.client}</Text>
                <StatusChip status={job.status}>
                  {job.status === "due-soon" ? "Due soon" : job.status[0]!.toUpperCase() + job.status.slice(1)}
                </StatusChip>
              </View>
              <ChevronRight size={18} color={colors.onSurfaceMuted} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </>
  );
}
