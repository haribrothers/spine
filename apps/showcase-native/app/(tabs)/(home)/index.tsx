import { useState } from "react";
import { Alert, ScrollView as RNScrollView, Platform, ScrollView, Text, View } from "react-native";
import {
  ActionTile,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  GaugeIndicator,
  KpiCard,
  SegmentedControl,
  StatusChip,
  ScrollEdgeMask,
  useNativeColors,
  type StatusChipProps,
} from "@spine/ui-native";
import type { GradientTone } from "@spine/ui-native/tokens";
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
 * Each KPI card's gradient comes from `colors.gradients` (`packages/ui-native`'s
 * shared token set — see its own doc comment) rather than a screen-local
 * light/dark map — a same-hue 2-stop pair derived from that card's OWN
 * semantic base color (`colors.primary`/`paid`/`dueSoon`/`overdue`, the
 * exact same tokens `StatusChip` already uses elsewhere in this screen),
 * never a new invented brand color, and never chosen by hand-threading an
 * `isDark` flag — `useNativeColors()` already resolves the theme once.
 */
type KpiTone = GradientTone;

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
 * `KpiCard`/`GaugeIndicator` moved to `packages/ui-native` (see those
 * modules' own doc comments for the full history — the gradient/arc-path
 * mechanism, the spring-overshoot animation, the comet-head glow dot) —
 * extracted from this file since both are genuinely general-purpose with
 * no dashboard-specific logic. `KPI_CARD_WIDTH`/`KPI_CARD_GAP` and the
 * horizontal-scroll carousel wrapper around `KpiCard` stay screen-local,
 * since sizing a card for THIS carousel's own "next card peeks" scroll
 * affordance is this screen's own layout decision, not the card's.
 *
 * The welcome/hero card — a wide, short, rounded rectangle at a real
 * `CARD_ASPECT_RATIO` of `1.5` (3:2 width:height, per explicit user
 * request — landscape-photo proportions). `aspectRatio` alone, NOT
 * combined with `minHeight` — a real, previously-fixed bug from an
 * earlier version: `aspectRatio` + `minHeight` together on a `View` with
 * no explicit `width` let React Native derive WIDTH from `minHeight`
 * instead of the other way around, and the card rendered wider than the
 * screen. Using `aspectRatio` alone here is safe specifically BECAUSE
 * nothing else on this card requires more vertical room than 3:2 at full
 * screen width actually gives.
 *
 * **Background is now a plain, flat `bg-surface-sunken` (light gray/
 * off-white) — no gradient, no `Svg` at all** — the FOURTH background
 * treatment this card has had, and a real, explicit user rejection of
 * every prior gradient attempt (linear orange→yellow→green, a 3-color
 * radial blue/yellow/red, then a simple 2-stop primary-blue gradient —
 * each one individually addressed real feedback from the attempt before
 * it, but the user still didn't like the result). This time the request
 * itself is a flat neutral background, not another gradient to tune —
 * `colors.surfaceSunken` (the same light-gray token `QUICK_ACTIONS`
 * tiles and the very first gauge-track color already used elsewhere on
 * this screen) is the plain, literal answer to "light gray or off-white,"
 * not a new invented tone.
 *
 * Text switched from white/white-translucent back to `on-surface`-toned
 * values (as it was for the second, also-light-background attempt) —
 * white has no contrast against a light gray card.
 *
 * The gauge's own colors are explicitly RETAINED as a distinct element,
 * not flattened to match the new neutral card — per explicit instruction
 * ("retain the color of the gauge"). Its previous fill was a near-white
 * gradient that only worked against a dark/saturated card and would be
 * invisible here, so it's repointed to the app's real primary-blue
 * gradient (`colors.gradients.primary` — the same pair the Outstanding
 * KPI card and the earlier solid-blue welcome-card attempt both already
 * used) — keeping the app's actual brand color as the gauge's "color,"
 * the intent behind "retain," rather than literally keeping now-invisible
 * white values.
 *
 * Stacked layout unchanged: greeting (`text-[26px]`) → the gauge,
 * centered → the revenue-goal numbers, centered below it.
 */
const CARD_ASPECT_RATIO = 1.5;

function WelcomeCard({
  cardBackgroundClassName,
  gaugeTrackColor,
  gaugeFillGradient,
}: {
  cardBackgroundClassName: string;
  gaugeTrackColor: string;
  gaugeFillGradient: { from: string; to: string };
}) {
  const goal = 25000;
  const current = 18900;
  const progress = current / goal;

  return (
    <View
      className={cardBackgroundClassName}
      style={{ aspectRatio: CARD_ASPECT_RATIO, borderRadius: 20, overflow: "hidden" }}
    >
      <View className="flex-1 items-center gap-2 p-5">
        <View className="w-full">
          <Text className="text-[26px] font-semibold text-on-surface dark:text-on-surface-dark">Good morning, Sam</Text>
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Spine Showcase Co.</Text>
        </View>
        <GaugeIndicator
          progress={progress}
          trackColor={gaugeTrackColor}
          fillGradient={gaugeFillGradient}
          textColorClass="text-on-surface dark:text-on-surface-dark"
        />
        <View className="items-center gap-0.5">
          <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">Revenue goal</Text>
          <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">
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
 * **The period `SegmentedControl` above the KPI carousel is
 * `@spine/ui-native`'s real, genuinely native component** (a thin wrapper
 * around `@expo/ui/community/segmented-control` — a real SwiftUI `Picker`
 * in `.segmented` style on iOS, a real Jetpack Compose
 * `SingleChoiceSegmentedButtonRow` on Android, confirmed by reading both
 * platform implementation files directly), not a hand-rolled NativeWind
 * row of `Pressable`s. Previously imported straight from `@expo/ui` here;
 * moved into `packages/ui-native` (`value`/`onValueChange` by string,
 * matching `Select`/`SelectField`'s own convention, rather than
 * `@expo/ui`'s index-based `selectedIndex`/`onChange`) so this app has no
 * direct `@expo/ui` import left anywhere — `packages/ui-native` is now the
 * sole `@expo/ui`/styling touchpoint apps consume. Placed directly below
 * the "Home"
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
  const gradients: Record<GradientTone, { from: string; to: string }> = colors.gradients;
  const gaugeTrackColor = colors.overlaySubtle;
  const gaugeFillGradient = colors.gradients.primary;
  const PERIOD_OPTIONS = ["This week", "This month", "This year"];
  const [period, setPeriod] = useState(PERIOD_OPTIONS[1]!);

  // `ActionTile` (see its own doc comment) added a real `onPress` this
  // screen's own Quick Actions tiles never had before — this showcase app
  // has no real quote/expense/photo/job creation flow to route to, so each
  // tile's own honest placeholder is a plain alert naming the action,
  // matching the same "display-only, no fake backing behavior" pattern
  // already used for the period `SegmentedControl` above.
  function handleQuickAction(label: string) {
    Alert.alert(label, "This showcase app has no real flow for this action yet.");
  }

  return (
    <>
      <WelcomeCard
        cardBackgroundClassName="bg-surface-sunken dark:bg-surface-sunken-dark"
        gaugeTrackColor={gaugeTrackColor}
        gaugeFillGradient={gaugeFillGradient}
      />

      <SegmentedControl values={PERIOD_OPTIONS} value={period} onValueChange={setPeriod} style={{ height: 36 }} />

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
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            icon={kpi.icon}
            gradient={gradients[kpi.tone]}
            gradientId={kpi.tone}
            width={KPI_CARD_WIDTH}
          />
        ))}
      </RNScrollView>

      <View className="gap-3">
        <Text className="text-[13px] font-medium uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          Quick actions
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_ACTIONS.map(({ label, icon }) => (
            <ActionTile key={label} label={label} icon={icon} iconColor={colors.primary} onPress={() => handleQuickAction(label)} />
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
