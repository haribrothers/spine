import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView as RNScrollView, Platform, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
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

const GAUGE_SIZE = 200;
const GAUGE_STROKE = 8;

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
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Animates a genuine sweep-in from 0% on mount, not an instant jump to the
 * final value — a real, explicit user request. `react-native`'s built-in
 * `Animated` API (already a transitive dependency of `react-native` itself,
 * no new package) drives a plain JS-side numeric value from 0 to `progress`
 * with `Animated.spring` (a slight overshoot-then-settle at the end, per
 * Mobbin research inferring this "snap into place" feel from Oura/CRED's
 * high-polish score reveals) rather than a linear `Animated.timing`;
 * `useNativeDriver: false` is required here (not a shortcut) since the
 * animated output feeds a `Path`'s own `d` STRING prop (recomputed every
 * frame from the current angle), and only transform/opacity style props
 * are eligible for the native driver — this is the same documented
 * tradeoff `FloatingTabBar`'s own tab-highlight animation in
 * `packages/ui-native` already accepts for an analogous non-transform
 * animated value, not a new pattern. A `Circle`'s `strokeDashoffset` COULD
 * run on the native driver instead, but this component already committed
 * to an explicit arc-path approach (see the doc comment above `arcPath`)
 * for its simpler, more predictable geometry at this small size —
 * switching just the animated portion to a dash-offset circle would
 * reintroduce exactly the half-circumference math this file deliberately
 * avoided, for a driver benefit that doesn't matter at one single small
 * animation running once per screen mount.
 *
 * A small glow-ringed dot rides the fill's leading tip (Experian/CRED's
 * and Oura's own "comet head"/slider-thumb detail, per Mobbin research) —
 * a second, smaller circle drawn at the same animated angle as the arc's
 * own end point, with a soft blurred halo behind it (a larger,
 * low-opacity circle at the same position, the cheapest fake-glow
 * technique available without a real blur filter). Tick marks at 0/25/
 * 50/75/100% are the other real stylistic detail this research surfaced
 * (small decorative reference points around the track, not functional
 * labels) — Mobbin's zone-gauge/dashed-arc references (Monzo, Rocket
 * Money) were considered too but not used: those imply a discrete
 * zone/segment framing this single continuous revenue-goal percentage
 * doesn't actually have.
 */
function GaugeIndicator({
  progress,
  trackColor,
  fillGradient,
  textColorClass,
}: {
  progress: number;
  trackColor: string;
  fillGradient: { from: string; to: string };
  textColorClass: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const [renderedProgress, setRenderedProgress] = useState(0);

  useEffect(() => {
    // Deliberately NOT clamped to [0,1] here — `Animated.spring`'s own
    // slight overshoot past `clamped` before settling back IS the "snap
    // into place" polish this animation is going for (per Mobbin research
    // on Oura/CRED's score reveals); clamping the raw value here would
    // silently flatten the spring into a plain ease-out and defeat the
    // whole point. The arc angle and glow-dot position below both clamp
    // their OWN derived values instead, so the overshoot bounces the fill
    // slightly past its final angle and back, while the displayed
    // percentage text still clamps to a sane 0-100 range.
    const id = animatedProgress.addListener(({ value }) => setRenderedProgress(value));
    Animated.spring(animatedProgress, {
      toValue: clamped,
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
    return () => animatedProgress.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per mount to `clamped`'s value at that time, matching a one-shot load-in sweep, not re-triggering on every re-render.
  }, []);

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
  // The arc's own SWEEP clamps to [0,1] (an SVG arc path can't visually
  // extend past the semicircle's own endpoints anyway, and letting it try
  // during a spring overshoot risks `largeArc` flipping unpredictably) —
  // only the glow dot below rides the raw, unclamped animated value for a
  // touch of extra life at the bounce.
  const sweepProgress = Math.max(0, Math.min(1, renderedProgress));
  const trackD = arcPath(180, 360);
  const progressD = arcPath(180, 180 + sweepProgress * 180);

  // The glow-ringed dot at the fill's leading tip (Experian/CRED's/Oura's
  // "comet head" detail, per Mobbin research) — allowed to ride slightly
  // PAST the arc's own endpoint during the spring's overshoot (clamped
  // only to a small overrun margin, not hard-clamped to 1), so the dot
  // visibly bounces a little beyond 100% before settling back, echoing the
  // spring's own motion rather than freezing at the arc's fixed end.
  const dotProgress = Math.max(0, Math.min(1.04, renderedProgress));
  const dotDeg = 180 + dotProgress * 180;
  const dotRad = (dotDeg * Math.PI) / 180;
  const dotX = cx + r * Math.cos(dotRad);
  const dotY = cy + r * Math.sin(dotRad);

  // Tick marks at 0/25/50/75/100% — small, decorative, stylish reference
  // points around the arc's own track (a real detail found in Mobbin's
  // credit-score/readiness-gauge references), NOT functional labels.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const deg = 180 + t * 180;
    const rad = (deg * Math.PI) / 180;
    const outer = r + GAUGE_STROKE / 2 + 4;
    const inner = r + GAUGE_STROKE / 2 + 1;
    return {
      x1: cx + inner * Math.cos(rad),
      y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad),
      y2: cy + outer * Math.sin(rad),
    };
  });

  return (
    <View style={{ width: GAUGE_SIZE, height: canvasHeight + 8 }}>
      <Svg width={GAUGE_SIZE} height={canvasHeight + 8}>
        <Defs>
          <SvgLinearGradient id="gauge-fill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={fillGradient.from} />
            <Stop offset="1" stopColor={fillGradient.to} />
          </SvgLinearGradient>
        </Defs>
        <Path d={trackD} stroke={trackColor} strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        {ticks.map((t, i) => (
          <Path key={i} d={`M ${t.x1} ${t.y1} L ${t.x2} ${t.y2}`} stroke={trackColor} strokeWidth={1.5} strokeLinecap="round" />
        ))}
        {sweepProgress > 0 ? (
          <AnimatedPath d={progressD} stroke="url(#gauge-fill)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        ) : null}
        {sweepProgress > 0.02 ? (
          <>
            <Circle cx={dotX} cy={dotY} r={GAUGE_STROKE / 2 + 7} fill={fillGradient.to} opacity={0.3} />
            <Circle cx={dotX} cy={dotY} r={GAUGE_STROKE / 2 + 1} fill="#FFFFFF" />
            <Circle cx={dotX} cy={dotY} r={GAUGE_STROKE / 2 - 2} fill={fillGradient.to} />
          </>
        ) : null}
      </Svg>
      <View style={{ position: "absolute", bottom: 8, left: 0, right: 0, alignItems: "center" }}>
        <Text className={`text-[32px] font-bold ${textColorClass}`}>{Math.round(sweepProgress * 100)}%</Text>
      </View>
    </View>
  );
}

/**
 * The welcome/hero card — a wide, short, rounded rectangle at a real
 * `CARD_ASPECT_RATIO` of `1.5` (3:2 width:height, per explicit user
 * request — landscape-photo proportions, noticeably wider/shorter than
 * the earlier ~1.586:1 credit-card ratio). `aspectRatio` alone, NOT
 * combined with `minHeight` — a real, previously-fixed bug from an
 * earlier version: `aspectRatio` + `minHeight` together on a `View` with
 * no explicit `width` let React Native derive WIDTH from `minHeight`
 * instead of deriving height from the (already width-constrained-by-its-
 * flex-parent) width, and the card rendered wider than the screen. Using
 * `aspectRatio` alone here is safe specifically BECAUSE nothing else on
 * this card requires more vertical room than 3:2 at full screen width
 * actually gives (~239pt at a ~358pt-wide screen) — the gauge below grew
 * larger specifically to use that space well, not to fight it.
 *
 * **Background is now a light, airy orange → yellow → green gradient**
 * (`WARM_WELCOME_GRADIENT`) — a real, explicit user request replacing the
 * previous blue-toned, lower-contrast version, which was ITSELF a fix for
 * an even-earlier bold/saturated blue. All three stops are pastel/light
 * (not saturated, per "should look more lighter"), sweeping corner-to-
 * corner diagonally — this is now a distinct, non-brand hero treatment
 * (no `colors.primary`/`primaryHover` derivation at all, unlike the KPI
 * cards), a deliberate choice since a 3-color warm sweep has no natural
 * single "semantic base color" to derive from the way the KPI cards'
 * single-hue gradients do.
 *
 * Stacked layout, largest-to-smallest visual weight top-to-bottom:
 * greeting (`text-[26px]`) → the gauge, centered, now larger/thinner
 * (`GAUGE_SIZE`/`GAUGE_STROKE`, see that component's own doc comment) →
 * the revenue-goal numbers, centered below it. Text/gauge-track colors
 * switched from white/white-translucent to dark `on-surface`-toned values
 * specifically because the new light background no longer has enough
 * contrast for white text — a real, necessary consequence of "lighter
 * background," not an unrelated change.
 */
const CARD_ASPECT_RATIO = 1.5;

const WARM_WELCOME_GRADIENT = {
  light: { from: "#FFE9C7", via: "#FFF3B0", to: "#D8F3D2" },
  dark: { from: "#4A3826", via: "#4A4626", to: "#2C4A30" },
} as const;

const GAUGE_TRACK_COLOR = { light: "rgba(33,31,26,0.12)", dark: "rgba(243,242,238,0.16)" };
const GAUGE_FILL_GRADIENT = {
  light: { from: "#F2994A", to: "#27AE60" },
  dark: { from: "#F2B23D", to: "#4ADE94" },
} as const;

function WelcomeCard({
  gradient,
  gaugeTrackColor,
  gaugeFillGradient,
  textColorClass,
  mutedTextColorClass,
}: {
  gradient: { from: string; via: string; to: string };
  gaugeTrackColor: string;
  gaugeFillGradient: { from: string; to: string };
  textColorClass: string;
  mutedTextColorClass: string;
}) {
  const goal = 25000;
  const current = 18900;
  const progress = current / goal;

  return (
    <View style={{ aspectRatio: CARD_ASPECT_RATIO, borderRadius: 20, overflow: "hidden" }}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <SvgLinearGradient id="welcome-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient.from} />
            <Stop offset="0.5" stopColor={gradient.via} />
            <Stop offset="1" stopColor={gradient.to} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcome-gradient)" />
      </Svg>
      <View className="flex-1 items-center gap-2 p-5">
        <View className="w-full">
          <Text className={`text-[26px] font-semibold ${textColorClass}`}>Good morning, Sam</Text>
          <Text className={`text-[13px] ${mutedTextColorClass}`}>Spine Showcase Co.</Text>
        </View>
        <GaugeIndicator progress={progress} trackColor={gaugeTrackColor} fillGradient={gaugeFillGradient} textColorClass={textColorClass} />
        <View className="items-center gap-0.5">
          <Text className={`text-[12px] ${mutedTextColorClass}`}>Revenue goal</Text>
          <Text className={`text-[15px] font-medium ${textColorClass}`}>
            ${current.toLocaleString()} / ${goal.toLocaleString()}
          </Text>
        </View>
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
  const isDark = colorScheme === "dark";
  const gradients = isDark ? KPI_GRADIENTS.dark : KPI_GRADIENTS.light;
  const welcomeGradient = isDark ? WARM_WELCOME_GRADIENT.dark : WARM_WELCOME_GRADIENT.light;
  const gaugeTrackColor = isDark ? GAUGE_TRACK_COLOR.dark : GAUGE_TRACK_COLOR.light;
  const gaugeFillGradient = isDark ? GAUGE_FILL_GRADIENT.dark : GAUGE_FILL_GRADIENT.light;
  const [period, setPeriod] = useState(1);

  return (
    <>
      <WelcomeCard
        gradient={welcomeGradient}
        gaugeTrackColor={gaugeTrackColor}
        gaugeFillGradient={gaugeFillGradient}
        textColorClass="text-on-surface dark:text-on-surface-dark"
        mutedTextColorClass="text-on-surface-muted dark:text-on-surface-muted-dark"
      />

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
