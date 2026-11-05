import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Reduce Motion (iOS) or Remove animations (Android); false if the platform can't say. */
export function isReduceMotionEnabled(): Promise<boolean> {
  return AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
}

/**
 * US-OPS-09 — whether the person asked their device for less motion, kept
 * current while the setting changes. False until the platform answers, so
 * a one-shot animation on mount should await `isReduceMotionEnabled()`
 * instead. Components with springs or timings jump straight to the final
 * value (`setValue`) when this is true (docs/design/motion.md).
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Only a change from the default re-renders.
    void isReduceMotionEnabled().then((value) => !cancelled && value && setReduce(true));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return reduce;
}
