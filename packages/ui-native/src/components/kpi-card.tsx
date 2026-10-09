import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * A gradient-filled stat card — label, value, trend text, and an icon.
 * Originally built for `apps/showcase-native`'s Home screen (its
 * horizontally-scrolling KPI carousel) — extracted here since the card
 * itself has zero dashboard-specific logic (no "revenue"/"jobs" concept
 * anywhere in this file, just `label`/`value`/`trend`/`icon`/`gradient`);
 * the carousel wrapper (a horizontal `ScrollView` with `snapToInterval`)
 * and the specific stat data stay screen-local, since those genuinely are
 * dashboard-specific.
 *
 * Built on `react-native-svg`'s `LinearGradient` (already this package's
 * established gradient mechanism — see `ScrollEdgeMask`'s own doc comment
 * — rather than adding `expo-linear-gradient` as a second, redundant
 * gradient dependency).
 *
 * Deliberately takes a fixed `width` prop, not `flex-1` — a card meant for
 * a horizontally-scrolling row needs a known per-card width so a carousel
 * wrapper can size its `snapToInterval` and deliberately let the final
 * card be clipped by the screen edge (the "next card peeks" scroll
 * affordance real reference apps use — bunq, Grab, Cleo, per Mobbin
 * research) rather than every card fitting exactly on screen with nothing
 * signaling there's more to scroll. This component itself doesn't know
 * it's inside a carousel — a caller not using one can simply render several
 * at a fixed or `flex-1` width in an ordinary `View` instead.
 *
 * `gradient` is a plain `{ from, to }` hex pair the CALLER supplies — this
 * component does no color derivation of its own (no "pick a shade darker
 * than this base color" logic), since a hand-tuned gradient per semantic
 * tone reliably looks better than an algorithmically-derived one for a
 * small, fixed set of tones; see `apps/showcase-native`'s own `KPI_GRADIENTS`
 * table for the worked example this was extracted from.
 */
export interface KpiCardProps {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ size?: number; color?: string; opacity?: number }>;
  gradient: { from: string; to: string };
  width?: number;
  /** A stable id for this card's own gradient `<Defs>` — required when multiple `KpiCard`s render in the same SVG-rendering context, so their gradient ids don't collide (matches the `tone` key `apps/showcase-native`'s own carousel already used as this id). */
  gradientId: string;
}

export function KpiCard({ label, value, trend, icon: Icon, gradient, width = 168, gradientId }: KpiCardProps) {
  // Text on the gradient is the on-fill role (D-099): white on light mode's
  // deep gradients, near-black on dark mode's lighter ones (MobHomeDark).
  const colors = useNativeColors();
  return (
    <View style={{ width, borderRadius: 16, overflow: "hidden" }}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={`kpi-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient.from} />
            <Stop offset="1" stopColor={gradient.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#kpi-${gradientId})`} />
      </Svg>
      <View className="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] text-on-primary/80 dark:text-on-primary-dark/80">{label}</Text>
          <Icon size={16} color={colors.onPrimary} opacity={0.8} />
        </View>
        <Text className="text-[22px] font-semibold text-on-primary dark:text-on-primary-dark">{value}</Text>
        <Text className="text-[12px] text-on-primary/80 dark:text-on-primary-dark/80">{trend}</Text>
      </View>
    </View>
  );
}
