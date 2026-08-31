import { View } from "react-native";
import { Skeleton } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

export function SkeletonScreen() {
  return (
    <DocScreen>
      <DocTitle>Skeleton</DocTitle>
      <DocLead>
        A pulsing block matching the shape of the loading content — used for genuinely slow loads, not every async
        state.
      </DocLead>

      <ComponentPreview>
        <View className="w-full gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </View>
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "A plain sizable block — pass width/height utility classes to match the content it replaces.",
            "The pulse is driven by RN's own Animated API, not a className — NativeWind (checked directly against the installed v4 dist) doesn't implement Tailwind's animate-* keyframe utilities, so a bare animate-pulse className would silently do nothing here.",
            "A real, confirmed-live bug found building this: putting className directly on the outer Animated.View compiled the opacity animation correctly but silently dropped every NativeWind class (bg-border-strong, h-4, w-48 — all gone) specifically on Expo web, even though the same code renders correctly on real iOS/Android. Fixed by moving className onto a plain View nested inside the Animated.View, which only carries the animated opacity style.",
            "A second real, confirmed-live bug, reported after the first fix: the block was invisible specifically in dark mode. Skeleton originally used the plain border token (bg-border), whose dark value is identical to surface-sunken's dark value — the background this preview box (and any similarly sunken container) renders against — so the block was the exact same color as its own background. Fixed by switching to border-strong, which is a genuinely distinct color from surface-sunken in both themes.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Skeleton } from "@spine/ui-native";

<Skeleton className="h-4 w-48" />;`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard View props" }]} />
      </DocSection>

      <DocSection title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<View className="gap-2">
  <Skeleton className="h-4 w-48" />
  <Skeleton className="h-4 w-32" />
</View>`}
        >
          <View className="w-full gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </View>
        </ComponentPreview>
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Purely visual — renders with no accessibility role or label, so a screen reader skips it rather than
          announcing something meaningless. Pair with a live-region &quot;Loading&quot; label elsewhere on screen
          where the loading state itself needs to be announced.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
