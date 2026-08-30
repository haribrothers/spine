import { Text, View } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "@spine/ui-native";
import {
  FLOATING_TAB_BAR_RESERVED_HEIGHT,
  FloatingTabBar,
  spineDarkNavigationTheme,
  spineLightNavigationTheme,
  TabBarIcon,
} from "@spine/ui-native/navigation";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { CodeBlock } from "../../src/components/code-block";

type DemoTabParamList = {
  Home: undefined;
  Jobs: undefined;
  Expenses: undefined;
  Messages: undefined;
  Profile: undefined;
};

const DemoTab = createBottomTabNavigator<DemoTabParamList>();

function DemoScreen({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">{label} screen</Text>
    </View>
  );
}

/**
 * Same `NavigationIndependentTree` + local `NavigationContainer` need as
 * `tab-bar.tsx`'s demo (see that file's own comment) — this screen can
 * render inside `DesktopShell`, which has no ancestor `NavigationContainer`.
 */
export function FloatingTabBarScreen() {
  const { resolvedMode } = useTheme();

  return (
    <DocScreen>
      <DocTitle>Floating Tab Bar</DocTitle>
      <DocLead>
        A fully custom bottom tab bar — a floating, rounded, inset pill with each tab&apos;s icon stacked above its
        label, and the active tab&apos;s highlight capsule sliding smoothly between tabs on selection, matching
        iOS&apos;s standard tab bar height/icon/label sizing. Replaces React Navigation&apos;s default tab bar
        entirely rather than just theming it (see Bottom Tab Bar for that lighter
        option).
      </DocLead>

      <DocSection title="Live demo">
        <View className="h-72 overflow-hidden rounded-lg border border-border bg-background dark:border-border-dark dark:bg-background-dark">
          <NavigationIndependentTree>
            <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
              <DemoTab.Navigator
                tabBar={(props) => <FloatingTabBar {...props} resolvedMode={resolvedMode} />}
                screenOptions={{
                  headerShown: false,
                  sceneStyle: { paddingBottom: FLOATING_TAB_BAR_RESERVED_HEIGHT },
                }}
              >
                <DemoTab.Screen
                  name="Home"
                  options={{ tabBarIcon: (props) => <TabBarIcon name="home" {...props} /> }}
                >
                  {() => <DemoScreen label="Home" />}
                </DemoTab.Screen>
                <DemoTab.Screen
                  name="Jobs"
                  options={{ tabBarIcon: (props) => <TabBarIcon name="briefcase" {...props} /> }}
                >
                  {() => <DemoScreen label="Jobs" />}
                </DemoTab.Screen>
                <DemoTab.Screen
                  name="Expenses"
                  options={{ tabBarIcon: (props) => <TabBarIcon name="dollar-sign" {...props} /> }}
                >
                  {() => <DemoScreen label="Expenses" />}
                </DemoTab.Screen>
                <DemoTab.Screen
                  name="Messages"
                  options={{ tabBarIcon: (props) => <TabBarIcon name="message-circle" {...props} /> }}
                >
                  {() => <DemoScreen label="Messages" />}
                </DemoTab.Screen>
                <DemoTab.Screen
                  name="Profile"
                  options={{ tabBarIcon: (props) => <TabBarIcon name="user" {...props} /> }}
                >
                  {() => <DemoScreen label="Profile" />}
                </DemoTab.Screen>
              </DemoTab.Navigator>
            </NavigationContainer>
          </NavigationIndependentTree>
        </View>
      </DocSection>

      <DocSection title="Features">
        <FeatureList
          items={[
            "Fully replaces React Navigation's default tab bar via the tabBar prop — every tab shows its icon stacked above its label; the active tab's highlight capsule slides smoothly to the newly selected tab instead of instantly swapping.",
            "Height (49pt), icon size (25pt), and label size (10pt) match iOS's own UITabBar/UITabBarItem defaults — the same numbers every unmodified iOS app's tab bar uses.",
            "Reads each screen's tabBarIcon/title from React Navigation's own descriptors — no separate icon/label config needed beyond what a themed tab bar already requires.",
            "Uses BottomTabBarProps' own insets (no separate useSafeAreaInsets call) to pad above the home indicator.",
            "Reimplements press handling with the same tabPress event contract the default tab bar uses, and sets accessibilityRole/accessibilityState itself, since replacing the tab bar means none of that comes for free anymore.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@spine/ui-native";
import { FLOATING_TAB_BAR_RESERVED_HEIGHT, FloatingTabBar, TabBarIcon } from "@spine/ui-native/navigation";

const Tab = createBottomTabNavigator();

function RootNavigator() {
  const { resolvedMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} resolvedMode={resolvedMode} />}
      screenOptions={{
        headerShown: false,
        // FloatingTabBar floats over content (position: absolute), so every
        // screen needs bottom padding at least this tall or its last row
        // sits behind it.
        sceneStyle: { paddingBottom: FLOATING_TAB_BAR_RESERVED_HEIGHT + insets.bottom },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: (props) => <TabBarIcon name="home" {...props} /> }}
      />
    </Tab.Navigator>
  );
}`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "FloatingTabBar", type: "BottomTabBarProps & { resolvedMode: \"light\" | \"dark\" }" },
            { prop: "FLOATING_TAB_BAR_RESERVED_HEIGHT", type: "number (77 — iOS's 49pt UITabBar height + outer padding)" },
          ]}
        />
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Each tab button sets `accessibilityRole=&quot;button&quot;` and `accessibilityState.selected` itself,
          since replacing React Navigation&apos;s default tab bar means those aren&apos;t provided automatically
          any more.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
