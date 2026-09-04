import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, DocSubsection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { CodeBlock } from "../../src/components/code-block";

/**
 * `@expo/ui`'s SwiftUI bindings only render real native content on an iOS
 * native build (a Dev Client or standalone build — NOT Expo Go, and NOT
 * this app's `--web` target, which is how `pnpm dev:ui-native` runs by
 * default). Importing the SwiftUI entry point on web/Android would throw,
 * so it's dynamically required only once we know we're on native iOS —
 * every other platform renders the fallback panel below instead.
 */
let TabView: typeof import("@expo/ui/swift-ui").TabView | null = null;
let Host: typeof import("@expo/ui/swift-ui").Host | null = null;
let GlassEffectContainer: typeof import("@expo/ui/swift-ui").GlassEffectContainer | null = null;
let glassEffect: typeof import("@expo/ui/swift-ui/modifiers").glassEffect | null = null;

if (Platform.OS === "ios") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const swiftUI = require("@expo/ui/swift-ui");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const modifiers = require("@expo/ui/swift-ui/modifiers");
  TabView = swiftUI.TabView;
  Host = swiftUI.Host;
  GlassEffectContainer = swiftUI.GlassEffectContainer;
  glassEffect = modifiers.glassEffect;
}

function UnsupportedPlatformNotice() {
  return (
    <View className="items-center gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-8 dark:border-border-dark dark:bg-surface-sunken-dark">
      <Text className="text-[14px] font-medium text-on-surface dark:text-on-surface-dark">iOS only</Text>
      <Text className="text-center text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
        `@expo/ui`&apos;s SwiftUI components (including the liquid-glass `TabView`) only render on a native iOS
        build. Run `pnpm dev:ui-native --ios` on a device or simulator with a Dev Client to see the live demo —
        it won&apos;t render in Expo Go, on Android, or on this app&apos;s default `--web` target.
      </Text>
    </View>
  );
}

function NativeTabViewDemo() {
  const [selection, setSelection] = useState("home");
  if (!TabView || !Host) return <UnsupportedPlatformNotice />;

  return (
    <Host matchContents style={{ height: 240 }}>
      <TabView selection={selection} onSelectionChange={setSelection}>
        <TabView.Tab value="home" label="Home" systemImage="house">
          <View />
        </TabView.Tab>
        <TabView.Tab value="jobs" label="Jobs" systemImage="briefcase">
          <View />
        </TabView.Tab>
        <TabView.Tab value="profile" label="Profile" systemImage="person">
          <View />
        </TabView.Tab>
      </TabView>
    </Host>
  );
}

function GlassEffectDemo() {
  if (!GlassEffectContainer || !Host || !glassEffect) return <UnsupportedPlatformNotice />;

  return (
    <Host matchContents>
      <GlassEffectContainer spacing={12}>
        <View
          style={{ height: 56, borderRadius: 28, paddingHorizontal: 20, justifyContent: "center" }}
          // @ts-expect-error -- modifiers are attached via the SwiftUI host bridge, not a standard RN style prop
          modifiers={[glassEffect()]}
        >
          <Text>Floating glass control</Text>
        </View>
      </GlassEffectContainer>
    </Host>
  );
}

export function NativeTabViewScreen() {
  return (
    <DocScreen>
      <DocTitle>Native Tab View (iOS)</DocTitle>
      <DocLead>
        `@expo/ui`&apos;s real SwiftUI `TabView` and `GlassEffectContainer` — genuine native components rendered by
        UIKit/SwiftUI itself, not a JS-drawn view. This is the only way to get iOS&apos;s actual liquid-glass
        material (a real-time system compositor blur of scrollable content behind it) — no NativeWind/Tailwind
        styling can reproduce that effect.
      </DocLead>

      <View className="rounded-lg border border-border bg-surface-sunken px-4 py-3 dark:border-border-dark dark:bg-surface-sunken-dark">
        <Text className="text-[13px] font-medium text-on-surface dark:text-on-surface-dark">Scope note</Text>
        <Text className="mt-1 text-[13px] leading-relaxed text-on-surface-muted dark:text-on-surface-muted-dark">
          `TabView`&apos;s own docs recommend `expo-router`&apos;s `unstable-native-tabs` for an app-wide routed
          native tab bar — that requires adopting Expo Router&apos;s file-based routing in place of React
          Navigation, a separate, larger decision this app hasn&apos;t made. This page demos `TabView` as what it
          actually is today: a native tab control you can embed inside one screen (e.g. segmented content within a
          detail view), alongside `packages/ui-native`&apos;s `FloatingTabBar` for app-wide navigation. It does not
          replace `RootNavigator`.
        </Text>
      </View>

      <DocSection title="Live demo">
        <DocSubsection title="TabView">
          <View className="overflow-hidden rounded-lg border border-border bg-background dark:border-border-dark dark:bg-background-dark">
            <NativeTabViewDemo />
          </View>
        </DocSubsection>

        <DocSubsection title="GlassEffectContainer">
          <View className="items-center overflow-hidden rounded-lg border border-border bg-surface p-8 dark:border-border-dark dark:bg-surface-dark">
            <GlassEffectDemo />
          </View>
        </DocSubsection>
      </DocSection>

      <DocSection title="Features">
        <FeatureList
          items={[
            "TabView renders a genuine SwiftUI tab control via a Host bridge view — real native chrome, not a NativeWind-styled View.",
            "tabViewStyle({ type: 'automatic' }) renders as a bottom tab bar with the system's real liquid-glass material on iOS 26+; other styles ('page', 'sidebarAdaptable') are available via the same modifier.",
            "GlassEffectContainer + the glassEffect() modifier apply the same liquid-glass material to any custom SwiftUI content, for a floating control that isn't a full TabView.",
            "iOS only — every other platform (Android, web, Expo Go) must render a fallback; there is no cross-platform equivalent.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Platform } from "react-native";

// @expo/ui's SwiftUI bindings throw on import outside a native iOS build —
// guard the import itself, not just the render.
const { TabView, Host } = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : {};

function Demo() {
  const [selection, setSelection] = useState("home");
  if (Platform.OS !== "ios") return <FallbackPanel />;

  return (
    <Host matchContents style={{ height: 240 }}>
      <TabView selection={selection} onSelectionChange={setSelection}>
        <TabView.Tab value="home" label="Home" systemImage="house">
          <HomeContent />
        </TabView.Tab>
        <TabView.Tab value="jobs" label="Jobs" systemImage="briefcase">
          <JobsContent />
        </TabView.Tab>
      </TabView>
    </Host>
  );
}`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "TabView.selection / onSelectionChange", type: "string / (value: string) => void — controlled selection" },
            { prop: "TabView.Tab", type: "{ value, label?, systemImage?: SFSymbol, children }" },
            { prop: "tabViewStyle(config)", type: "modifier — { type: 'automatic' | 'page' | 'sidebarAdaptable' }" },
            { prop: "GlassEffectContainer", type: "{ children, spacing? } — wraps views using the glassEffect() modifier" },
            { prop: "Host", type: "bridge view required to render any @expo/ui swift-ui component into the RN tree" },
          ]}
        />
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Native SwiftUI accessibility (VoiceOver labels/traits for tabs) is provided by the OS itself — unlike
          `FloatingTabBar`, there is no manual `accessibilityRole`/`accessibilityState` wiring to do here.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
