import { Platform, ScrollView, Text, View } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Search from "lucide-react-native/icons/search";
import { useTheme, Button } from "@spine/ui-native";
import { spineDarkNavigationTheme, spineLightNavigationTheme } from "@spine/ui-native/navigation";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { CodeBlock } from "../../src/components/code-block";

type DemoStackParamList = {
  Inbox: undefined;
};

const DemoStack = createNativeStackNavigator<DemoStackParamList>();

function DemoContent() {
  const rows = Array.from({ length: 20 }, (_, i) => i);
  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-2 p-4">
      {rows.map((i) => (
        <View key={i} className="rounded-lg border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
          <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">Row {i + 1}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Same `NavigationIndependentTree` + local `NavigationContainer` need as
 * `tab-bar.tsx`'s demo (see that file's own comment) — this screen can
 * render inside `DesktopShell`, which has no ancestor `NavigationContainer`.
 */
export function NativeHeaderScreen() {
  const { resolvedMode } = useTheme();

  return (
    <DocScreen>
      <DocTitle>Native Header</DocTitle>
      <DocLead>
        React Navigation&apos;s native-stack header — a genuinely native `UINavigationBar` on iOS (with a real
        translucent/blur material behind scrolled content) and a native Material `TopAppBar` on Android — rather
        than a JS-drawn `View`-based top bar. Controls placed in `headerLeft`/`headerRight` stay
        `packages/ui-native` components, themed the same as everywhere else.
      </DocLead>

      <DocSection title="Live demo">
        <Text className="mb-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          Scroll the list to see the header&apos;s blur/elevation respond to content underneath it.
        </Text>
        <View className="h-96 overflow-hidden rounded-lg border border-border dark:border-border-dark">
          <NavigationIndependentTree>
            <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
              <DemoStack.Navigator>
                <DemoStack.Screen
                  name="Inbox"
                  component={DemoContent}
                  options={{
                    title: "Inbox",
                    // headerTransparent + headerBlurEffect only render a real blur on iOS
                    // (a system compositor effect) — on Android/web this combination just
                    // leaves the header transparent with no blur, which reads as broken
                    // (content visibly overlapping the title) rather than intentional, so
                    // those platforms get the normal solid header instead.
                    ...(Platform.OS === "ios"
                      ? {
                          headerLargeTitle: true,
                          headerTransparent: true,
                          headerBlurEffect: resolvedMode === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
                        }
                      : {}),
                    headerRight: () => (
                      <Button variant="ghost">
                        <Search size={20} color={resolvedMode === "dark" ? "#F3F2EE" : "#211F1A"} />
                      </Button>
                    ),
                  }}
                />
              </DemoStack.Navigator>
            </NavigationContainer>
          </NavigationIndependentTree>
        </View>
      </DocSection>

      <View className="rounded-lg border border-border bg-surface-sunken px-4 py-3 dark:border-border-dark dark:bg-surface-sunken-dark">
        <Text className="text-[13px] font-medium text-on-surface dark:text-on-surface-dark">Platform behavior</Text>
        <Text className="mt-1 text-[13px] leading-relaxed text-on-surface-muted dark:text-on-surface-muted-dark">
          `headerTransparent` + `headerBlurEffect` only produce a real system-compositor blur on iOS — everywhere
          else that combination leaves the header transparent with no blur, so this demo passes those options (and
          `headerLargeTitle`, also iOS-only) on iOS alone; Android and web render the normal solid header, themed by
          `spineLightNavigationTheme`/`spineDarkNavigationTheme`&apos;s `colors.card`/`colors.text` (see
          `navigation-theme.ts`).
        </Text>
      </View>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Real native chrome on both platforms — a UINavigationBar on iOS, a Material TopAppBar on Android — not a NativeWind-styled View, so it gets platform-correct behavior (blur, elevation-on-scroll, safe-area handling) for free.",
            "headerTransparent + headerBlurEffect (iOS only) gives a true system-compositor blur of scrolled content behind the header, the same effect FloatingTabBar's liquid-glass sibling can't reproduce in JS.",
            "headerLargeTitle collapses to the standard inline title on scroll, matching iOS's own large-title navigation pattern.",
            "headerLeft/headerRight still render packages/ui-native components (Button here) — only the bar chrome itself is native, controls stay on-brand.",
            "Themed via the same spineLightNavigationTheme/spineDarkNavigationTheme already used for tab bar chrome (see Bottom Tab Bar/Floating Tab Bar), so header and tab bar pick up theme changes together.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Search from "lucide-react-native/icons/search";
import { useTheme, Button } from "@spine/ui-native";

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { resolvedMode } = useTheme();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: "Inbox",
          // headerTransparent + headerBlurEffect only produce a real blur on iOS —
          // elsewhere they just leave the header transparent with no blur, which
          // reads as broken rather than intentional, so gate them to iOS.
          ...(Platform.OS === "ios"
            ? {
                headerLargeTitle: true,
                headerTransparent: true,
                headerBlurEffect: resolvedMode === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
              }
            : {}),
          headerRight: () => (
            <Button size="icon" variant="ghost" accessibilityLabel="Search">
              <Search size={20} />
            </Button>
          ),
        }}
      />
    </Stack.Navigator>
  );
}`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "headerLargeTitle", type: "boolean — iOS only" },
            { prop: "headerTransparent", type: "boolean — iOS only, pair with headerBlurEffect" },
            { prop: "headerBlurEffect", type: '"systemChromeMaterialLight" | "systemChromeMaterialDark" | ... — iOS only' },
            { prop: "headerLeft / headerRight", type: "() => React.ReactNode — render any packages/ui-native component" },
            { prop: "NavigationContainer theme", type: "spineLightNavigationTheme | spineDarkNavigationTheme — themes the solid (non-transparent) header state and Android's TopAppBar" },
          ]}
        />
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Header title and back-button semantics are React Navigation&apos;s own native-stack accessibility
          behavior (VoiceOver/TalkBack read the title and back action automatically); only the custom
          `headerRight`/`headerLeft` controls need their own `accessibilityLabel`, same as anywhere else a
          `packages/ui-native` `Button` is used icon-only.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
