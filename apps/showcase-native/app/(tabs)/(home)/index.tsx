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
 * causes under `headerLargeTitleEnabled`.
 *
 * **`ScrollView` must be this screen's own direct root on iOS — NOT wrapped
 * in an outer `View`, a real, reproduced, user-reported bug.** The large
 * title never collapsed on scroll at all: it stayed rendered at its full
 * expanded size and position, floating on top of the scrolled content
 * underneath (confirmed via a real animated `scrollTo` + colored marker
 * blocks proving the content genuinely scrolled while the title didn't
 * move). Root cause: this screen previously wrapped its `ScrollView` in an
 * outer `<View className="flex-1">` so the Android-only `ScrollEdgeMask`
 * had a sibling to render into — but `react-native-screens`' large-title
 * collapse tracking depends on auto-detecting the screen's own scroll view
 * (its `RNSScrollViewFinder` heuristic, the same one CLAUDE.md already
 * documents as "only walks a screen's first-level subview"), and an extra
 * wrapping `View` around the `ScrollView` defeats that detection entirely —
 * confirmed by temporarily removing the wrapper: the large title correctly
 * collapsed into the small pinned nav-bar title with zero overlap. Since
 * `ScrollEdgeMask` is Android-only anyway, the fix is platform-conditional:
 * iOS renders `ScrollView` as the true root (styled directly, no wrapper);
 * Android keeps the wrapping `View` it actually needs for the mask sibling.
 * Apply this same "ScrollView must be the direct root on iOS" rule to any
 * future screen in this app that uses `headerLargeTitleEnabled`.
 */
function HomeContent({ colors }: { colors: ReturnType<typeof useNativeColors> }) {
  return (
    <>
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
    </>
  );
}

export default function HomeScreen() {
  const colors = useNativeColors();

  if (Platform.OS === "android") {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-6 p-4" contentContainerStyle={{ paddingBottom: 48 }}>
          <HomeContent colors={colors} />
        </ScrollView>
        <ScrollEdgeMask edge="bottom" />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-6 p-4"
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      <HomeContent colors={colors} />
    </ScrollView>
  );
}
