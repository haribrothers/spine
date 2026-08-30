import { Text, View } from "react-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, DocSubsection, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

// border-strong, not border — these render inside ComponentPreview's
// surface-sunken background, which in dark mode is the exact same color as
// the plain `border` token (#2C2B26 both), making that border invisible.
// border-strong is a distinct color from surface-sunken in both themes.
function Demo({ children }: { children: React.ReactNode }) {
  return <View className="gap-1 rounded-md border border-border-strong dark:border-border-strong-dark p-2">{children}</View>;
}

function Chip({ children }: { children: string }) {
  return (
    <View className="rounded-md border border-border-strong dark:border-border-strong-dark p-2">
      <Text className="text-[13px] text-on-surface dark:text-on-surface-dark">{children}</Text>
    </View>
  );
}

export function LayoutPrimitivesScreen() {
  return (
    <DocScreen>
      <DocTitle>Layout primitives</DocTitle>
      <DocLead>
        @spine/ui has five structural primitives — Box, Flex, Grid, Container, Section — because a plain web div has
        no layout behavior on its own and needs an explicit display: flex to opt in. @spine/ui-native has none of
        these, deliberately: React Native&apos;s View is flexbox by default (flexDirection: &quot;column&quot;, not
        row), so there&apos;s no equivalent gap to wrap a component around.
      </DocLead>

      <DocSection title="Web primitive → native equivalent">
        <DocSubsection title="Box → View">
          <DocLead>
            A plain View with a padding className. The p shorthand prop exists on web because Tailwind padding
            classes are verbose to hand-write repeatedly; NativeWind classNames are just as short as the prop would
            be, so there&apos;s nothing for a wrapper to shorten.
          </DocLead>
          <ComponentPreview code={`<View className="p-3 rounded-md border border-border">Content</View>`}>
            <Demo>
              <Text className="text-[13px] text-on-surface dark:text-on-surface-dark">Content</Text>
            </Demo>
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection title="Flex → View (flex-row / gap-*)">
          <DocLead>
            View is already a flex container. direction=&quot;row&quot; becomes className=&quot;flex-row&quot;; gap is a real NativeWind
            utility mapped to the same spacing scale Foundation → Spacing documents — this is the pattern used
            throughout this app&apos;s own doc-screen previews (see button.tsx, badge.tsx).
          </DocLead>
          <ComponentPreview code={`<View className="flex-row items-center gap-3">\n  <Chip>A</Chip>\n  <Chip>B</Chip>\n</View>`}>
            <View className="flex-row items-center gap-3">
              <Chip>A</Chip>
              <Chip>B</Chip>
            </View>
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection title="Grid → flex-row flex-wrap, or a fixed-count row">
          <DocLead>
            React Native has no CSS grid at all (not a NativeWind gap — RN&apos;s own layout engine, Yoga, doesn&apos;t
            implement the grid spec). A fixed column count is built by hand — either flex-wrap with a percentage
            width per item, or explicit flex-1 siblings for a known column count.
          </DocLead>
          <ComponentPreview
            code={`<View className="flex-row gap-2">\n  <View className="flex-1"><Chip>1</Chip></View>\n  <View className="flex-1"><Chip>2</Chip></View>\n  <View className="flex-1"><Chip>3</Chip></View>\n</View>`}
          >
            <View className="w-full flex-row gap-2">
              <View className="flex-1">
                <Chip>1</Chip>
              </View>
              <View className="flex-1">
                <Chip>2</Chip>
              </View>
              <View className="flex-1">
                <Chip>3</Chip>
              </View>
            </View>
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection title="Container / Section → not applicable">
          <DocLead>
            Both exist on web to solve desktop-browser problems this app doesn&apos;t have: Container caps content at
            a 1200px reading width on an ultra-wide monitor; Section adds generous vertical page-section padding for
            a scrolling marketing-style page. A phone screen is already narrow, and every screen here is a single
            DocScreen (a ScrollView with fixed padding) rather than a sequence of stacked page sections — there&apos;s
            no analogous constraint to wrap.
          </DocLead>
        </DocSubsection>
      </DocSection>

      <DocSection title="What plays AppShell's role">
        <DocLead>
          Web&apos;s AppShell — a collapsible sidebar + header + content region — has no direct native port; a
          persistent desktop-style sidebar isn&apos;t how a phone screen navigates. The native equivalent of
          &quot;the persistent shell every screen renders inside&quot; is a navigation shell instead: see
          spineTabBarScreenOptions / TabBarIcon and FloatingTabBar under Components, both from
          @spine/ui-native/navigation. apps/mobile uses the plain themed tab bar; this app itself uses FloatingTabBar.
        </DocLead>
      </DocSection>

      <DocSection title="Spacing scale reference">
        <DocLead>
          tailwind.config.js registers Foundation → Spacing&apos;s named scale as gap-xs / gap-sm / gap-md / gap-lg /
          gap-xl / gap-2xl (and the p-* equivalents) alongside Tailwind&apos;s own default numeric scale — but in
          practice, every screen in this app (including its own doc-screen previews) reaches for the numeric scale
          instead, e.g. gap-3 / p-4, the way the examples throughout this app do. The named scale exists in config
          but isn&apos;t the convention actually followed today; worth reconciling if a real design decision is made
          to standardize on one.
        </DocLead>
        <ApiTable
          rows={[
            { prop: "gap-1", type: "4px" },
            { prop: "gap-2", type: "8px" },
            { prop: "gap-3", type: "12px" },
            { prop: "gap-4", type: "16px" },
            { prop: "gap-xs", type: "4px (named token)" },
            { prop: "gap-md", type: "12px (named token)" },
          ]}
        />
        <CodeBlock code={`<View className="flex-row items-center gap-3 p-4">...</View>`} />
      </DocSection>
    </DocScreen>
  );
}
