import { Text, View } from "react-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";
import { CodeBlock } from "../../src/components/code-block";

export function MotionScreen() {
  return (
    <DocScreen>
      <DocTitle>Motion</DocTitle>
      <DocLead>
        Motion is functional, not decorative — it confirms a state changed, never used to delight or draw attention
        to itself. Same principle as web (see Overview → Principles), but @spine/ui-native has no shared duration/
        easing token module yet — unlike packages/config&apos;s CSS custom properties, every animation here configures
        its own timing inline, per component.
      </DocLead>

      <DocSection title="What exists today">
        <DocLead>
          FloatingTabBar&apos;s active-tab highlight is the one real, considered animation in this library —
          Animated.spring with a hand-tuned bounciness/speed, not a fixed-duration tween:
        </DocLead>
        <CodeBlock
          code={`Animated.parallel([
  Animated.spring(highlightX, { toValue: layout.x, useNativeDriver: false, bounciness: 6, speed: 16 }),
  Animated.spring(highlightWidth, { toValue: layout.width, useNativeDriver: false, bounciness: 6, speed: 16 }),
]).start();`}
        />
        <DocLead>
          useNativeDriver: false is deliberate here, not an oversight — left/width aren&apos;t in the native driver&apos;s
          supported style-property allowlist (only transforms/opacity are), and this is a single infrequent
          transition, not a scroll-linked or high-frequency animation, so running it on the JS thread is an
          acceptable tradeoff. See floating-tab-bar.tsx&apos;s own doc comment for the full reasoning, including why
          the very first measurement is snapped instead of animated (avoiding a visible slide-in from the
          top-left corner on mount).
        </DocLead>
      </DocSection>

      <DocSection title="Reduced motion">
        <DocLead>
          Not yet wired up. React Native exposes reduced-motion via AccessibilityInfo.isReduceMotionEnabled() /
          the reduceMotionEnabled event, but no component in this library checks it today — unlike web&apos;s
          prefers-reduced-motion CSS media query, which collapses every duration automatically. This is a real gap
          worth closing before FloatingTabBar (or any future animation) ships more broadly.
        </DocLead>
      </DocSection>

      <DocSection title="What web has that this doesn't (yet)">
        <View className="my-2 gap-1.5 rounded-lg border border-border dark:border-border-dark p-4">
          <Text className="text-[13px] text-on-surface dark:text-on-surface-dark">
            • A shared duration scale (instant/fast/base/slow) — every animation here hardcodes its own timing.
          </Text>
          <Text className="text-[13px] text-on-surface dark:text-on-surface-dark">
            • Named easing curves (standard/decelerate/accelerate) — RN&apos;s Animated.spring uses physical parameters
            (bounciness/speed) instead of a cubic-bezier easing curve, so these aren&apos;t a direct port even once a
            token module exists.
          </Text>
        </View>
      </DocSection>
    </DocScreen>
  );
}
