import { Platform, ScrollView, Text, View } from "react-native";
import { Card, CardContent, CardDescription, CardTitle, StatusChip, ScrollEdgeMask, useNativeColors, type StatusChipProps } from "@spine/ui-native";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Clock from "lucide-react-native/icons/clock";
import Wallet from "lucide-react-native/icons/wallet";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Plus from "lucide-react-native/icons/plus";
import FileText from "lucide-react-native/icons/file-text";
import Camera from "lucide-react-native/icons/camera";

const KPIS = [
  { label: "Outstanding", value: "$42,300", icon: Wallet, trend: "+8% this month" },
  { label: "Jobs in progress", value: "6", icon: ClipboardList, trend: "2 due this week" },
];

const RECENT_JOBS: { id: string; title: string; client: string; status: NonNullable<StatusChipProps["status"]> }[] = [
  { id: "1", title: "Kitchen extension", client: "Acme Contracting Ltd.", status: "paid" },
  { id: "2", title: "Roof repair", client: "Northside Builders", status: "due-soon" },
  { id: "3", title: "Bathroom remodel", client: "Coastal Renovations", status: "overdue" },
];

const QUICK_ACTIONS = [
  { label: "New quote", icon: FileText },
  { label: "Log expense", icon: Wallet },
  { label: "Add photo", icon: Camera },
  { label: "New job", icon: Plus },
];

/**
 * A real sample dashboard, not a bare scrollable row list — KPI summary
 * cards, a quick-actions row, and a recent-activity list, the kind of
 * content a real Home tab would actually show. Replaces the earlier
 * 30-identical-rows placeholder, which was only ever meant to verify
 * scrolling/blur mechanics (Phase 3) and was never meant to ship as the
 * app's actual first impression (user feedback).
 *
 * `contentInsetAdjustmentBehavior="automatic"` is still REQUIRED here — see
 * `(home)/_layout.tsx`'s doc comment for the real, reproduced bug (large-
 * title header text rendering over this screen's content) that omitting it
 * causes under `headerLargeTitleEnabled`. The large title collapsing into
 * the small inline title as you scroll (rather than scrolling away with
 * the content) is correct native `headerLargeTitleEnabled` behavior, not a
 * bug — the same mechanism iOS's own Settings/Mail apps use.
 */
export default function HomeScreen() {
  const colors = useNativeColors();

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 p-4"
        contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 16 }}
      >
        <View className="flex-row gap-3">
          {KPIS.map(({ label, value, icon: Icon, trend }) => (
            <Card key={label} className="flex-1 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
                <Icon size={16} color={colors.onSurfaceMuted} />
              </View>
              <Text className="text-[22px] font-semibold text-on-surface dark:text-on-surface-dark">{value}</Text>
              <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{trend}</Text>
            </Card>
          ))}
        </View>

        <View className="gap-3">
          <Text className="text-[13px] font-medium uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
            Quick actions
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
              <View key={label} className="items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
                <Icon size={20} color={colors.primary} />
                <Text className="text-[12px] font-medium text-on-surface dark:text-on-surface-dark">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-medium uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
              Recent jobs
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-[13px] font-medium text-primary dark:text-primary-dark">See all</Text>
              <ArrowUpRight size={14} color={colors.primary} />
            </View>
          </View>
          {RECENT_JOBS.map((job) => (
            <Card key={job.id} className="gap-2">
              <CardTitle>{job.title}</CardTitle>
              <CardDescription>{job.client}</CardDescription>
              <CardContent className="flex-row items-center justify-between">
                <StatusChip status={job.status}>
                  {job.status === "due-soon" ? "Due soon" : job.status[0]!.toUpperCase() + job.status.slice(1)}
                </StatusChip>
                <View className="flex-row items-center gap-1">
                  <Clock size={12} color={colors.onSurfaceMuted} />
                  <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">Updated 2d ago</Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
      {Platform.OS === "android" ? <ScrollEdgeMask edge="bottom" /> : null}
    </View>
  );
}
