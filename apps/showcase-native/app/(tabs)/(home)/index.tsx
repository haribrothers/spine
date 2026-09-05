import { useState } from "react";
import { ScrollView as RNScrollView, Platform, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
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

const GAUGE_SIZE = 148;
const GAUGE_STROKE = 12;

/**
 * A semi-circular (180°) gauge, arc + filled progress + a centered value —
 * NOT a full 360° ring. Per Mobbin research (Cleo's credit-score gauge,
 * TradingView's buy/sell needle gauge, Acorns' Weak/Fair/Strong gauge,
 * Binance's Fear & Greed gauge): every real "speedometer-style" dashboard
 * indicator found was consistently a semi-circle with the value centered
 * inside the arc, never a full ring (full rings — Apple Fitness/WHOOP-style
 * — are a different, more common pattern reserved for a different framing
 * this component deliberately does NOT use here).
 *
 * Built as a plain `react-native-svg` arc path (already this package's
 * established gradient/shape mechanism — see `KpiCard`/`ScrollEdgeMask` —
 * no new charting dependency). The arc is drawn as two stacked `Path`s: a
 * full semi-circle track at low opacity, and a progress arc on top whose
 * end angle is `progress`-driven — simpler and more predictable at this
 * small size than a `strokeDasharray`/`strokeDashoffset` approach on a
 * `Circle`, since a true circle's dash-offset math has to be adjusted for
 * exactly half a circumference here, whereas an explicit arc path takes
 * the end angle directly.
 */
function GaugeIndicator({ progress, trackColor, fillColor }: { progress: number; trackColor: string; fillColor: string }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = GAUGE_SIZE / 2 - GAUGE_STROKE / 2;
  // The SVG canvas is only half-height (a semi-circle, open side up) plus
  // room for the stroke's own rounded caps — `cy` must sit at that canvas's
  // OWN bottom edge (canvasHeight), not at `GAUGE_SIZE / 2` (half of the
  // full, never-rendered circle) — that mismatch was a real bug: the arc's
  // true center point sat below the visible canvas, so only its very top
  // sliver was visible and the "76%" label (positioned assuming a centered
  // arc) rendered too high, overlapping the arc's own opening instead of
  // sitting inside it.
  const canvasHeight = GAUGE_SIZE / 2 + GAUGE_STROKE;
  const cx = GAUGE_SIZE / 2;
  const cy = canvasHeight;

  const arcPath = (fromDeg: number, toDeg: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const start = { x: cx + r * Math.cos(toRad(fromDeg)), y: cy + r * Math.sin(toRad(fromDeg)) };
    const end = { x: cx + r * Math.cos(toRad(toDeg)), y: cy + r * Math.sin(toRad(toDeg)) };
    const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  // 180deg (left) through 270deg (top, since SVG's y-axis grows downward so
  // negative-y is "up") to 360deg (right) — a dome bulging upward, flat
  // side down, the correct speedometer/rainbow shape. Verified by direct
  // trig (not assumed): cos/sin at 180/270/360 place the arc's top point
  // at negative y, confirming the bulge is genuinely upward, not downward.
  const trackD = arcPath(180, 360);
  const progressD = arcPath(180, 180 + clamped * 180);

  return (
    <View style={{ width: GAUGE_SIZE, height: canvasHeight }}>
      <Svg width={GAUGE_SIZE} height={canvasHeight}>
        <Path d={trackD} stroke={trackColor} strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        {clamped > 0 ? (
          <Path d={progressD} stroke={fillColor} strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        ) : null}
      </Svg>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" }}>
        <Text className="text-[24px] font-bold text-white">{Math.round(clamped * 100)}%</Text>
      </View>
    </View>
  );
}

const SPARKLINE_WEEKLY_REVENUE = [3200, 4100, 3800, 5200, 4700, 6100, 5900];

/**
 * A small inline sparkline — plain `react-native-svg` `Path` polyline, no
 * charting library. Per Mobbin research, real apps place a sparkline
 * directly under a plain balance number (Revolut Business, Wealthsimple)
 * rather than layered onto other card content — placed here directly below
 * the revenue-goal line in the welcome card's own left column, in the
 * whitespace that column already had, not overlapping the gauge.
 */
function Sparkline({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((value, i) => ({
    x: i * stepX,
    y: height - ((value - min) / range) * height,
  }));
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/**
 * The welcome/hero card — sized to real physical-credit-card proportions
 * (`CARD_ASPECT_RATIO`, the standard ~1.586:1 bank-card ratio), gradient
 * background, greeting on the left and a semi-circular revenue-goal gauge
 * on the right — a deliberate, explicit user choice to embed the gauge
 * INSIDE the credit-card hero rather than as its own separate card below
 * it (the more common real-app pattern per Mobbin research — Apple
 * Wallet/CRED/bunq/Klarna all keep a card-shaped tile as a plain
 * balance/identity surface, with gauges like Cleo's/Acorns' living on
 * their own separate plain rectangular card elsewhere) — confirmed and
 * proceeded with per explicit instruction, not a default recommendation.
 * Side-by-side (not stacked) layout is a direct consequence of the fixed
 * card aspect ratio: at a realistic ~358pt card width the 1.586:1 ratio
 * gives only ~226pt of height total, and a stacked "greeting on top,
 * gauge below" layout doesn't comfortably fit both a 2-line greeting AND a
 * gauge tall enough to read — greeting-left/gauge-right uses the width
 * this card shape actually has plenty of instead.
 *
 * Gradient built the same way as `KpiCard` (`react-native-svg`'s
 * `LinearGradient`, no new dependency) using `colors.primary`/
 * `primaryHover` — the same brand pair already used elsewhere, not an
 * invented new hue for this one card.
 */
const CARD_ASPECT_RATIO = 1.586;

function WelcomeCard({ gradient }: { gradient: { from: string; to: string } }) {
  const goal = 25000;
  const current = 18900;
  const progress = current / goal;

  return (
    <View style={{ aspectRatio: CARD_ASPECT_RATIO, borderRadius: 20, overflow: "hidden" }}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <SvgLinearGradient id="welcome-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient.from} />
            <Stop offset="1" stopColor={gradient.to} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcome-gradient)" />
      </Svg>
      <View className="flex-1 flex-row items-center justify-between p-5">
        <View className="flex-1 gap-1 pr-3">
          <Text className="text-[19px] font-semibold text-white">Good morning, Sam</Text>
          <Text className="text-[12px] text-white/75">Spine Showcase Co.</Text>
          <Text className="mt-3 text-[12px] text-white/75">Revenue goal</Text>
          <Text className="text-[13px] font-medium text-white">
            ${current.toLocaleString()} / ${goal.toLocaleString()}
          </Text>
          <View className="mt-3">
            <Sparkline data={SPARKLINE_WEEKLY_REVENUE} width={120} height={28} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
        <GaugeIndicator progress={progress} trackColor="rgba(255,255,255,0.25)" fillColor="#FFFFFF" />
      </View>
    </View>
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
 *
 * **The period `SegmentedControl` above the KPI carousel is `@expo/ui`'s
 * real, genuinely native component** (`@expo/ui/community/segmented-
 * control` — a real SwiftUI `Picker` in `.segmented` style on iOS, a real
 * Jetpack Compose `SingleChoiceSegmentedButtonRow` on Android, confirmed by
 * reading both platform implementation files directly), not a hand-rolled
 * NativeWind row of `Pressable`s — matching this codebase's established
 * native-first rule for any control with a real native equivalent (see
 * `packages/ui-native/src/components/select.tsx`'s own precedent for the
 * same `@expo/ui` consumption pattern). Placed directly below the "Home"
 * large title and above the KPI carousel it conceptually filters,
 * mirroring where real reference apps (TIDE/Me+/timespent, via Mobbin
 * research) place a Week/Month/Year control relative to the stat card it
 * controls — never floating on top of the gradient hero card itself. It's
 * currently DISPLAY-ONLY (selecting a period doesn't yet change which
 * numbers the KPI cards show — this showcase app has no real backing data
 * per-period to switch between) — a real, honest limitation, not a bug;
 * wiring it to actually filter `KPIS`/`WelcomeCard`'s numbers is a
 * follow-up once/if this screen gets real mocked per-period data.
 */
function HomeContent({ colors }: { colors: ReturnType<typeof useNativeColors> }) {
  const { colorScheme } = useColorScheme();
  const gradients = colorScheme === "dark" ? KPI_GRADIENTS.dark : KPI_GRADIENTS.light;
  const [period, setPeriod] = useState(1);

  return (
    <>
      <WelcomeCard gradient={gradients.primary} />

      <SegmentedControl
        values={["This week", "This month", "This year"]}
        selectedIndex={period}
        onChange={(event) => setPeriod(event.nativeEvent.selectedSegmentIndex)}
        style={{ height: 36 }}
      />

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
