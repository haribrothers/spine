import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { useColorScheme } from "nativewind";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import Camera from "lucide-react-native/icons/camera";
import Check from "lucide-react-native/icons/check";
import CircleCheck from "lucide-react-native/icons/circle-check";
import MapPin from "lucide-react-native/icons/map-pin";
import Receipt from "lucide-react-native/icons/receipt";
import { SPINE_MARK_LAYERS, useNativeColors } from "@spine/ui-native";
import { brandColors, darkColors, lightColors } from "@spine/ui-native/tokens";

/**
 * D-203, D-204 — the parts Welcome (US-MOB-26) and Sign in (US-MOB-01) draw
 * their illustration from: the brand glow, the mark's layers, sparkles and
 * small cards showing the app's own work. All of it is decoration; the
 * screens hide it from screen readers. Brand colours only appear here, never
 * on text (US-MOB-27).
 */

/** The soft teal-to-sky glow behind the mark. */
export function BrandGlow({ size }: { size: number }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="brand-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={brandColors.teal} stopOpacity={dark ? 0.15 : 0.22} />
          <Stop offset="0.55" stopColor={brandColors.sky} stopOpacity={dark ? 0.12 : 0.16} />
          <Stop offset="1" stopColor={brandColors.sky} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={`M0 ${size / 2}a${size / 2} ${size / 2} 0 1 0 ${size} 0a${size / 2} ${size / 2} 0 1 0 ${-size} 0`} fill="url(#brand-glow)" />
    </Svg>
  );
}

/** One of the mark's three layers, drawn in the same 128 box as the whole mark so stacked layers line up. */
export function MarkLayer({ layer, size }: { layer: 0 | 1 | 2; size: number }) {
  const { key, d, y } = SPINE_MARK_LAYERS[layer];
  const gradient = brandColors.gradients[key];
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Defs>
        <LinearGradient id={`mark-${key}`} x1="64" y1={y[0]} x2="64" y2={y[1]} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={gradient.from} />
          <Stop offset="1" stopColor={gradient.to} />
        </LinearGradient>
      </Defs>
      <Path d={d} fill={`url(#mark-${key})`} />
    </Svg>
  );
}

/** A small diamond that twinkles in the illustration. */
export function Sparkle({ tone, size = 7 }: { tone: "teal" | "sky" | "deep"; size?: number }) {
  const { colorScheme } = useColorScheme();
  // The deep blue disappears on the dark page, so it lightens to sky there.
  const color = tone === "deep" && colorScheme === "dark" ? brandColors.sky : brandColors[tone];
  return <View style={{ width: size, height: size, borderRadius: 2, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />;
}

/** The white (or dark-surface) card every piece of work sits on. */
export function WorkCard({ children, style, className }: { children: ReactNode; style?: ViewStyle; className?: string }) {
  const { colorScheme } = useColorScheme();
  // A dark shadow in both modes: dark mode's neutral900 is near-white and would glow.
  const shadow = colorScheme === "dark" ? darkColors.background : lightColors.neutral900;
  return (
    <View
      className={["rounded-[14px] bg-surface dark:bg-surface-dark", colorScheme === "dark" ? "border border-border-dark" : "", className ?? "px-3 py-2.5"].join(" ")}
      style={[{ shadowColor: shadow, shadowOpacity: colorScheme === "dark" ? 0.5 : 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 6 }, style]}
    >
      {children}
    </View>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <Text className="text-[11px] font-medium text-on-surface-muted dark:text-on-surface-muted-dark">{children}</Text>;
}

function Meta({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <View className="mt-1.5 flex-row items-center gap-1">
      {icon}
      <Text numberOfLines={1} className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">
        {children}
      </Text>
    </View>
  );
}

function Chip({ tone, children }: { tone: "due" | "paid"; children: string }) {
  return (
    <View className={`ml-auto rounded-full px-2 py-px ${tone === "due" ? "bg-due-soon-bg dark:bg-due-soon-bg-dark" : "bg-paid-bg dark:bg-paid-bg-dark"}`}>
      <Text className={`text-[11px] font-medium ${tone === "due" ? "text-due-soon dark:text-due-soon-dark" : "text-paid dark:text-paid-dark"}`}>{children}</Text>
    </View>
  );
}

/** Today's job: "Marina office fit-out", its address and when it's due. */
export function JobCard({ showDue = true }: { showDue?: boolean }) {
  const colors = useNativeColors();
  return (
    <WorkCard>
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: brandColors.teal }} />
        <Kicker>Today · 8:00</Kicker>
      </View>
      <Text numberOfLines={1} className="mt-0.5 text-[14px] font-semibold text-on-surface dark:text-on-surface-dark">
        Marina office fit-out
      </Text>
      <View className="flex-row items-center">
        <Meta icon={<MapPin size={13} color={colors.onSurfaceMuted} />}>14 Harbour St</Meta>
        {showDue ? (
          <View className="ml-auto mt-1.5">
            <Chip tone="due">Due Sat</Chip>
          </View>
        ) : null}
      </View>
    </WorkCard>
  );
}

/** A site photo on a polaroid: the striped placeholder used across the app's designs. */
export function PhotoCard({ label = "3 photos saved", photoHeight = 66 }: { label?: string; photoHeight?: number }) {
  const colors = useNativeColors();
  return (
    <WorkCard className="px-1.5 pb-2 pt-1.5">
      <View style={{ height: photoHeight }} className="items-center justify-center rounded-[9px] bg-surface-sunken dark:bg-surface-sunken-dark">
        <Camera size={22} color={colors.onSurfaceMuted} />
      </View>
      <Meta icon={label.includes("saved") ? <Check size={13} color={colors.paid} /> : undefined}>{label}</Meta>
    </WorkCard>
  );
}

/** A fuel receipt and its amount. */
export function ReceiptCard() {
  const colors = useNativeColors();
  return (
    <WorkCard className="flex-row items-center gap-2.5 px-3 py-2.5">
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-due-soon-bg dark:bg-due-soon-bg-dark">
        <Receipt size={18} color={colors.dueSoon} />
      </View>
      <View>
        <Kicker>Fuel</Kicker>
        <Text className="text-[14px] font-semibold text-on-surface dark:text-on-surface-dark">$64.20</Text>
      </View>
    </WorkCard>
  );
}

/** The customer's signature on QUO-0004, as drawn on a phone (US-MOB-17). */
export const SIGNATURE_PATH = "M4 22c8-12 15-16 17-9s-5 12 0 9 10-16 15-12-2 14 5 10 9-9 14-7 3 7 10 3 12-7 19-5 9 3 50-3";
export const SIGNATURE_LENGTH = 400;

export function QuoteCard({ signature }: { signature: ReactNode }) {
  return (
    <WorkCard>
      <View className="flex-row items-center">
        <Kicker>QUO-0004</Kicker>
        <Chip tone="paid">Signed</Chip>
      </View>
      {signature}
      <Meta>Alan Reyes</Meta>
    </WorkCard>
  );
}

/** "Foundations · Completed": a milestone ticked off from the phone (US-MOB-15). */
export function MilestonePill({ compact = false }: { compact?: boolean }) {
  const colors = useNativeColors();
  return (
    <WorkCard className={`flex-row items-center gap-2 rounded-full ${compact ? "h-[34px] pl-2 pr-3" : "h-10 pl-2.5 pr-4"}`}>
      <CircleCheck size={compact ? 16 : 18} color={colors.paid} />
      <Text className={`${compact ? "text-[12px]" : "text-[13px]"} font-semibold text-on-surface dark:text-on-surface-dark`}>Foundations</Text>
      {compact ? null : <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Completed</Text>}
    </WorkCard>
  );
}
