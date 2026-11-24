import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { isReduceMotionEnabled } from "../hooks/use-reduce-motion";

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
 * Originally built for `apps/showcase-native`'s Home screen (its revenue-
 * goal gauge) — extracted here since it's a genuinely general-purpose
 * progress/score indicator with zero dashboard-specific logic: `progress`/
 * `trackColor`/`fillGradient`/`textColorClass` are the whole API, no
 * "revenue" or job-domain concept anywhere in this file.
 *
 * Built as a plain `react-native-svg` arc path (already this package's
 * established gradient/shape mechanism — see `ScrollEdgeMask`'s own doc
 * comment — no new charting dependency). The arc is drawn as two stacked
 * `Path`s: a full semi-circle track at low opacity, and a progress arc on
 * top whose end angle is `progress`-driven — simpler and more predictable
 * at this small size than a `strokeDasharray`/`strokeDashoffset` approach
 * on a `Circle`, since a true circle's dash-offset math has to be adjusted
 * for exactly half a circumference here, whereas an explicit arc path
 * takes the end angle directly.
 *
 * Animates a genuine sweep-in from 0% on mount, not an instant jump to the
 * final value — a real, explicit user request. RN's built-in `Animated`
 * API (already a transitive dependency of `react-native` itself, no new
 * package) drives a plain JS-side numeric value from 0 to `progress` with
 * `Animated.spring` (a slight overshoot-then-settle at the end, per Mobbin
 * research inferring this "snap into place" feel from Oura/CRED's
 * high-polish score reveals) rather than a linear `Animated.timing`;
 * `useNativeDriver: false` is required here (not a shortcut) since the
 * animated output feeds a `Path`'s own `d` STRING prop (recomputed every
 * frame from the current angle), and only transform/opacity style props
 * are eligible for the native driver — the same documented tradeoff
 * `FloatingTabBar`'s own tab-highlight animation in this package already
 * accepts for an analogous non-transform animated value, not a new
 * pattern. A `Circle`'s `strokeDashoffset` COULD run on the native driver
 * instead, but this component already committed to an explicit arc-path
 * approach for its simpler, more predictable geometry at this small size —
 * switching just the animated portion to a dash-offset circle would
 * reintroduce exactly the half-circumference math this file deliberately
 * avoided, for a driver benefit that doesn't matter at one single small
 * animation running once per mount.
 *
 * A small glow-ringed dot rides the fill's leading tip (Experian/CRED's
 * and Oura's own "comet head"/slider-thumb detail, per Mobbin research) —
 * a second, smaller circle drawn at the same animated angle as the arc's
 * own end point, with a soft blurred halo behind it (a larger, low-opacity
 * circle at the same position, the cheapest fake-glow technique available
 * without a real blur filter). Tick marks at 0/25/50/75/100% are the other
 * real stylistic detail this research surfaced (small decorative
 * reference points around the track, not functional labels) — Mobbin's
 * zone-gauge/dashed-arc references (Monzo, Rocket Money) were considered
 * too but not used: those imply a discrete zone/segment framing a single
 * continuous progress value doesn't actually have.
 */
export interface GaugeIndicatorProps {
  /** 0–1. Values outside this range are clamped for the displayed percentage; the animated fill/glow-dot are allowed a small overshoot past 1 during the spring settle (see the doc comment above). */
  progress: number;
  /** The unfilled track's stroke color — pass a low-opacity/muted color for a subtle background arc. */
  trackColor: string;
  /** The animated fill's gradient — also colors the glow dot and the center-value text is styled separately via `textColorClass`. */
  fillGradient: { from: string; to: string };
  /** A NativeWind className for the centered percentage text (e.g. `"text-on-surface dark:text-on-surface-dark"`) — this component has no native color prop of its own for it, matching this package's other NativeWind-styled (non-`@expo/ui`) components. */
  textColorClass: string;
}

const GAUGE_SIZE = 200;
const GAUGE_STROKE = 8;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function GaugeIndicator({ progress, trackColor, fillGradient, textColorClass }: GaugeIndicatorProps) {
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
    let cancelled = false;
    // US-OPS-09: with Reduce Motion on, the gauge shows its final value at once, no spring.
    void isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        animatedProgress.setValue(clamped);
        return;
      }
      Animated.spring(animatedProgress, {
        toValue: clamped,
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }).start();
    });
    return () => {
      cancelled = true;
      animatedProgress.stopAnimation();
      animatedProgress.removeListener(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per mount to `clamped`'s value at that time, matching a one-shot load-in sweep, not re-triggering on every re-render.
  }, []);

  const r = GAUGE_SIZE / 2 - GAUGE_STROKE / 2;
  // The SVG canvas is only half-height (a semi-circle, open side up) plus
  // room for the stroke's own rounded caps — `cy` must sit at that canvas's
  // OWN bottom edge (canvasHeight), not at `GAUGE_SIZE / 2` (half of the
  // full, never-rendered circle) — that mismatch was a real bug: the arc's
  // true center point sat below the visible canvas, so only its very top
  // sliver was visible and the percentage label (positioned assuming a
  // centered arc) rendered too high, overlapping the arc's own opening
  // instead of sitting inside it.
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
          <LinearGradient id="gauge-fill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={fillGradient.from} />
            <Stop offset="1" stopColor={fillGradient.to} />
          </LinearGradient>
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
