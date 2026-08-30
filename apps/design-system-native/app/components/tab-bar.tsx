import { Text, View } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "@spine/ui-native";
import {
  spineDarkNavigationTheme,
  spineLightNavigationTheme,
  spineTabBarScreenOptions,
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
 * `createBottomTabNavigator` needs exactly one `NavigationContainer` per
 * navigation tree. This screen can render either inside `RootNavigator`'s
 * own `NavigationContainer` (mobile/narrow layout) OR inside `DesktopShell`,
 * which has NO `NavigationContainer` anywhere in its tree at all (its own
 * selection model deliberately avoids React Navigation — see its own doc
 * comment) — so a bare nested `DemoTab.Navigator` crashed with "Couldn't
 * register the navigator" on the desktop layout specifically (confirmed
 * live: reproduced with a headless-browser click before fixing). `
 * NavigationIndependentTree` (React Navigation's own supported mechanism
 * for exactly this — a self-contained nested navigation tree) plus this
 * screen's own `NavigationContainer` makes the demo below work correctly
 * regardless of whether an ancestor `NavigationContainer` exists.
 */
export function TabBarScreen() {
  const { resolvedMode } = useTheme();

  return (
    <DocScreen>
      <DocTitle>Bottom Tab Bar</DocTitle>
      <DocLead>
        Themed `screenOptions` and a matching icon helper for `createBottomTabNavigator` — React Navigation&apos;s
        own tab bar isn&apos;t a NativeWind-styled component, so it needs real color values resolved from the
        current theme rather than `dark:` classes.
      </DocLead>

      <DocSection title="Live demo">
        <View className="h-72 overflow-hidden rounded-lg border border-border bg-background dark:border-border-dark dark:bg-background-dark">
          <NavigationIndependentTree>
            <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
              <DemoTab.Navigator screenOptions={spineTabBarScreenOptions(resolvedMode)}>
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
            "spineTabBarScreenOptions(resolvedMode) themes the tab bar's background, border, and active/inactive tint colors from the same light/dark tokens every other component uses.",
            "TabBarIcon wraps @expo/vector-icons' Feather so apps don't need their own icon-library import or per-tab color-resolution boilerplate — React Navigation already passes the correct active/inactive color into tabBarIcon.",
            "Each Tab.Screen still supplies its own icon name and title — those are necessarily per-route, not shared.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "@spine/ui-native";
import { spineTabBarScreenOptions, TabBarIcon } from "@spine/ui-native/navigation";

const Tab = createBottomTabNavigator();

function RootNavigator() {
  const { resolvedMode } = useTheme();
  return (
    <Tab.Navigator screenOptions={spineTabBarScreenOptions(resolvedMode)}>
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
            { prop: "spineTabBarScreenOptions(resolvedMode)", type: '"light" | "dark" -> BottomTabNavigationOptions' },
            { prop: "TabBarIcon", type: "{ name: Feather icon name; color: string; size: number }" },
          ]}
        />
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          Tab buttons, selection state, and labels are React Navigation&apos;s own native tab-bar accessibility
          behavior — unaffected by this theming layer.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
