import { useState } from "react";
import { Pressable } from "react-native";
import Search from "lucide-react-native/icons/search";
import { NavigationContainer, useNavigation, type NavigationProp } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@spine/ui-native";
import {
  FLOATING_TAB_BAR_RESERVED_HEIGHT,
  FloatingTabBar,
  spineDarkNavigationTheme,
  spineLightNavigationTheme,
  TabBarIcon,
} from "@spine/ui-native/navigation";
import { SectionListScreen } from "../../app/home";
import { ComponentDetailScreen } from "../../app/component-detail";
import { NAV_SECTIONS, type SectionSlug } from "../lib/nav-sections";
import { ThemeToggle } from "../components/theme-toggle";
import { SearchPalette } from "../components/search-palette";

export type SectionStackParamList = {
  List: undefined;
  Detail: { slug: string };
};

export type RootTabParamList = Record<SectionSlug, undefined>;

/**
 * Root navigation param list as seen from anywhere in the tree: each tab
 * name maps to its nested stack's own screens, so a `navigation.navigate`
 * call can jump straight to another section's Detail screen in one call
 * (e.g. from the search palette, which can select a result belonging to a
 * section other than the one currently focused) — React Navigation resolves
 * this by bubbling the navigate action up to the common tab-navigator
 * ancestor when the target screen isn't found in the local stack.
 */
type RootParamList = {
  [K in SectionSlug]: { screen: "Detail"; params: { slug: string } } | undefined;
};

const SectionStack = createNativeStackNavigator<SectionStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function SearchButton() {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation<NavigationProp<RootParamList>>();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search"
        onPress={() => setOpen(true)}
        className="h-8 w-8 items-center justify-center rounded-md active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
      >
        <Search size={18} color="#726C5A" />
      </Pressable>
      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        onSelect={(slug, section) => navigation.navigate(section, { screen: "Detail", params: { slug } })}
      />
    </>
  );
}

/**
 * One native-stack per top-level nav section (List -> Detail), so drilling
 * into e.g. "Button" pushes a detail screen with a back button, same as
 * before — just duplicated per section instead of one shared stack. Each
 * section's stack is itself one tab inside the outer FloatingTabBar.
 */
function makeSectionStackNavigator(section: SectionSlug) {
  const items = NAV_SECTIONS.find((s) => s.slug === section)!.items;
  const title = NAV_SECTIONS.find((s) => s.slug === section)!.title;

  return function SectionStackNavigator() {
    return (
      <SectionStack.Navigator
        screenOptions={{
          headerRight: () => (
            <>
              <SearchButton />
              <ThemeToggle />
            </>
          ),
        }}
      >
        <SectionStack.Screen name="List" options={{ title }}>
          {({ navigation }) => (
            <SectionListScreen items={items} onSelect={(slug) => navigation.navigate("Detail", { slug })} />
          )}
        </SectionStack.Screen>
        <SectionStack.Screen
          name="Detail"
          options={({ route }) => ({
            title: items.find((entry) => entry.slug === route.params.slug)?.name ?? route.params.slug,
          })}
        >
          {({ route }) => <ComponentDetailScreen section={section} slug={route.params.slug} />}
        </SectionStack.Screen>
      </SectionStack.Navigator>
    );
  };
}

export function RootNavigator() {
  const { resolvedMode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} resolvedMode={resolvedMode} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { paddingBottom: FLOATING_TAB_BAR_RESERVED_HEIGHT + insets.bottom },
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <Tab.Screen
            key={section.slug}
            name={section.slug}
            component={makeSectionStackNavigator(section.slug)}
            options={{
              title: section.title,
              tabBarIcon: (props) => <TabBarIcon icon={section.icon} {...props} />,
            }}
          />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
