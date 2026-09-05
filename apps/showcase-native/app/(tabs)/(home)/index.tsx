import { ScrollView as RNScrollView, Platform, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import { Card, CardContent, CardDescription, CardTitle, StatusChip, ScrollEdgeMask, useNativeColors, type StatusChipProps } from "@spine/ui-native";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Clock from "lucide-react-native/icons/clock";
import Wallet from "lucide-react-native/icons/wallet";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
// `circle-check`/`triangle-alert`, NOT `check-circle-2`/`alert-triangle` —
// the older names still have a `.d.ts` type stub in this installed
// lucide-react-native version (so TypeScript alone won't catch the
// mistake) but no matching `.mjs`/`.js` implementation file, so Metro
// fails to resolve them at runtime with a real bundler error. Confirmed
// by checking this package's actual `dist/esm/icons/` directory contents
// directly rather than guessing from memory.
import CircleCheck from "lucide-react-native/icons/circle-check";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import Plus from "lucide-react-native/icons/plus";
import FileText from "lucide-react-native/icons/file-text";
import Camera from "lucide-react-native/icons/camera";

/**
 * Each KPI card's gradient is a same-hue 2-stop pair derived from that
 * card's OWN semantic base color (`colors.primary`/`paid`/`dueSoon`/
 * `overdue`, the exact same tokens `StatusChip` already uses elsewhere in
 * this screen) — never a new invented brand color. Per real-app research
 * (bunq/Grab/Cleo, via Mobbin), a bold single-hue gradient per card is the
 * common pattern, not a busy multi-color blend, so `to` is just a
 * ~15-18%-darker (light mode) / ~25%-darker (dark mode, since dark-mode
 * base tones are already light/vivid and need a stronger pull toward
 * saturation rather than lightening) shade of `from` — precomputed here as
 * plain hex literals per theme rather than a runtime color-math helper,
 * since exactly 4 cards × 2 themes is a fixed, small, unchanging set.
 */
const KPI_GRADIENTS = {
  light: {
    primary: { from: "#2954E5", to: "#2144BB" },
    paid: { from: "#177044", to: "#125B37" },
    dueSoon: { from: "#9A6300", to: "#7E5100" },
    overdue: { from: "#B3261E", to: "#921F18" },
  },
  dark: {
    primary: { from: "#6B8AFF", to: "#5067BF" },
    paid: { from: "#4ADE94", to: "#37A66F" },
    dueSoon: { from: "#F2B23D", to: "#B5852D" },
    overdue: { from: "#F17B72", to: "#B45C55" },
  },
} as const;

type KpiTone = keyof typeof KPI_GRADIENTS.light;

const KPIS: { label: string; value: string; icon: typeof Wallet; trend: string; tone: KpiTone }[] = [
  { label: "Outstanding", value: "$42,300", icon: Wallet, trend: "+8% this month", tone: "primary" },
  { label: "Jobs in progress", value: "6", icon: ClipboardList, trend: "2 due this week", tone: "dueSoon" },
  { label: "Paid this month", value: "$18,900", icon: CircleCheck, trend: "12 invoices", tone: "paid" },
  { label: "Overdue", value: "$3,150", icon: TriangleAlert, trend: "1 invoice", tone: "overdue" },
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

const KPI_CARD_WIDTH = 168;
const KPI_CARD_GAP = 12;

/**
 * One gradient-filled KPI card, built on `react-native-svg`'s
 * `LinearGradient` (already this package's established pattern for
 * gradients — see `ScrollEdgeMask` — rather than adding
 * `expo-linear-gradient` as a second, redundant gradient dependency).
 * Fixed `KPI_CARD_WIDTH`, not `flex-1`, is deliberate: a horizontally
 * scrolling row needs a known per-card width so the FINAL card can be
 * DELIBERATELY clipped by the screen edge (the "next card peeks" scroll
 * affordance every real reference app in this pattern uses — bunq, Grab,
 * Cleo, confirmed via Mobbin research) rather than every card fitting
 * exactly on screen with nothing signaling there's more to scroll.
 */
function KpiCard({ label, value, trend, icon: Icon, tone, gradient }: (typeof KPIS)[number] & { gradient: { from: string; to: string } }) {
  return (
    <View style={{ width: KPI_CARD_WIDTH, borderRadius: 16, overflow: "hidden" }}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <SvgLinearGradient id={`kpi-${tone}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient.from} />
            <Stop offset="1" stopColor={gradient.to} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#kpi-${tone})`} />
      </Svg>
      <View className="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] text-white/80">{label}</Text>
          <Icon size={16} color="#FFFFFF" opacity={0.8} />
        </View>
        <Text className="text-[22px] font-semibold text-white">{value}</Text>
        <Text className="text-[12px] text-white/80">{trend}</Text>
      </View>
    </View>
  );
}

/**
 * Compact welcome card — a greeting plus ONE lightweight progress
 * indicator (a plain horizontal bar, not a chart) toward this month's
 * revenue goal. Per real-app research (Mobbin: bunq/Grab/Monzo use a real
 * line chart; Fiverr/Cleo use a simpler progress bar/slider instead) —
 * this app's daily financial data is thin (a handful of invoices/jobs, not
 * continuous transaction volume), so a real line chart would have almost
 * no meaningful shape to show and would read as decoration rather than
 * information. A single progress bar toward a concrete, named goal
 * ("$18,900 of $25,000 goal") is honest about the data this app actually
 * has, and needs no charting library — plain `View`s only.
 */
function WelcomeCard() {
  const goal = 25000;
  const current = 18900;
  const progress = Math.min(1, current / goal);

  return (
    <Card className="gap-4">
      <View>
        <Text className="text-[20px] font-semibold text-on-surface dark:text-on-surface-dark">Good morning, Sam</Text>
        <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          Here's how Spine Showcase Co. is doing this month.
        </Text>
      </View>
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] font-medium text-on-surface dark:text-on-surface-dark">Revenue goal</Text>
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
            ${current.toLocaleString()} / ${goal.toLocaleString()}
          </Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-surface-sunken-dark">
          <View
            className="h-full rounded-full bg-primary dark:bg-primary-dark"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
      </View>
    </Card>
  );
}

/**
 * A real sample dashboard, not a bare scrollable row list — a welcome
 * card, a horizontally-scrolling gradient KPI carousel, an equal-size
 * tinted quick-actions grid, and a recent-activity list. Replaces an
 * earlier, deliberately plainer version (2 flat bordered KPI cards,
 * uneven-width quick-action boxes) per explicit user feedback that the
 * original design read as dull/low-effort for a first-impression screen —
 * restyled after researching real dashboard/home-screen patterns (bunq,
 * Grab, Cleo, Remote Global HR, Fiverr, via Mobbin) rather than guessing.
 *
 * `contentInsetAdjustmentBehavior="automatic"` is still REQUIRED here — see
 * `(home)/_layout.tsx`'s doc comment for the real, reproduced bug (large-
 * title header text rendering over this screen's content) that omitting it
 * causes under `headerLargeTitleEnabled`.
 *
 * **`ScrollView` must be this screen's own direct root on iOS — NOT wrapped
 * in an outer `View`, a real, reproduced, user-reported bug.** See git
 * history / this file's own long-standing doc comment for the full
 * `RNSScrollViewFinder` large-title collapse-tracking rationale — still
 * unchanged by this redesign; the KPI carousel's own inner horizontal
 * `ScrollView` is a SEPARATE, nested scroll view and doesn't interact with
 * this outer rule at all (only the screen's own top-level scroll view must
 * avoid an extra wrapper).
 */
function HomeContent({ colors }: { colors: ReturnType<typeof useNativeColors> }) {
  const { colorScheme } = useColorScheme();
  const gradients = colorScheme === "dark" ? KPI_GRADIENTS.dark : KPI_GRADIENTS.light;

  return (
    <>
      <WelcomeCard />

      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={KPI_CARD_WIDTH + KPI_CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: KPI_CARD_GAP, paddingRight: 32 }}
        className="-mx-4"
        contentContainerClassName="px-4"
      >
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} gradient={gradients[kpi.tone]} />
        ))}
      </RNScrollView>

      <View className="gap-3">
        <Text className="text-[13px] font-medium uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          Quick actions
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
            <View
              key={label}
              className="items-center justify-center gap-2 rounded-xl bg-info-bg py-4 dark:bg-info-bg-dark"
              style={{ width: "22%", flexGrow: 1 }}
            >
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
