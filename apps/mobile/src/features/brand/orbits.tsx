import { useEffect } from "react";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { useNativeColors } from "@spine/ui-native";
import { brandColors } from "@spine/ui-native/tokens";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface OrbitRing {
  rx: number;
  ry: number;
}

export interface OrbitDot {
  ring: number;
  tone: "teal" | "sky";
  r: number;
  /** ms for one lap. */
  period: number;
  /** Where on the ring it sits when still, in turns (0–1). */
  phase: number;
  reverse?: boolean;
}

interface OrbitsProps {
  width: number;
  height: number;
  rings: OrbitRing[];
  dots?: OrbitDot[];
  /** The dashes drift and the dots travel while true; everything holds still otherwise (Reduce Motion, off screen). */
  moving: boolean;
  /** ms for the dashes to drift one full pattern. */
  driftPeriod?: number;
}

const DASH = "2 7";
const DRIFT = 180;

/**
 * D-204 — the dashed isometric orbits behind the mark, with dots that travel
 * them. Drawn in an SVG of the given size, centred.
 */
export function Orbits({ width, height, rings, dots = [], moving, driftPeriod = 14000 }: OrbitsProps) {
  const colors = useNativeColors();
  const drift = useSharedValue(0);
  const first = useSharedValue(0);
  const second = useSharedValue(0);

  useEffect(() => {
    const loops: [SharedValue<number>, number][] = [
      [drift, driftPeriod],
      [first, dots[0]?.period ?? 0],
      [second, dots[1]?.period ?? 0],
    ];
    for (const [value, period] of loops) {
      cancelAnimation(value);
      if (moving && period) value.value = withRepeat(withTiming(value.value + 1, { duration: period, easing: Easing.linear }), -1, false);
    }
    return () => loops.forEach(([value]) => cancelAnimation(value));
  }, [moving, drift, first, second, driftPeriod, dots]);

  const cx = width / 2;
  const cy = height / 2;
  return (
    <Svg width={width} height={height}>
      {rings.map((ring, index) => (
        <Ring key={index} ring={ring} cx={cx} cy={cy} drift={drift} reverse={index % 2 === 1} stroke={colors.borderStrong} />
      ))}
      {dots.slice(0, 2).map((dot, index) => (
        <Dot key={index} dot={dot} ring={rings[dot.ring]!} cx={cx} cy={cy} lap={index === 0 ? first : second} />
      ))}
    </Svg>
  );
}

function Ring({ ring, cx, cy, drift, reverse, stroke }: { ring: OrbitRing; cx: number; cy: number; drift: SharedValue<number>; reverse: boolean; stroke: string }) {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: (reverse ? 1 : -1) * DRIFT * (drift.value % 1) }));
  return <AnimatedEllipse cx={cx} cy={cy} rx={ring.rx} ry={ring.ry} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={DASH} strokeLinecap="round" animatedProps={animatedProps} />;
}

function Dot({ dot, ring, cx, cy, lap }: { dot: OrbitDot; ring: OrbitRing; cx: number; cy: number; lap: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const turn = (dot.phase + (dot.reverse ? -1 : 1) * lap.value) * 2 * Math.PI;
    return { cx: cx + ring.rx * Math.cos(turn), cy: cy + ring.ry * Math.sin(turn) };
  });
  return <AnimatedCircle r={dot.r} fill={brandColors[dot.tone]} animatedProps={animatedProps} />;
}
