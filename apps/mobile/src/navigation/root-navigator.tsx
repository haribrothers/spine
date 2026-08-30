import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTheme } from "@spine/ui-native";
import {
  spineDarkNavigationTheme,
  spineLightNavigationTheme,
  spineTabBarScreenOptions,
  TabBarIcon,
} from "@spine/ui-native/navigation";
import { ExpensesScreen } from "../features/expenses/expenses-screen";
import { HomeScreen } from "../features/home/home-screen";
import { JobsScreen } from "../features/jobs/jobs-screen";
import { ProfileScreen } from "../features/profile/profile-screen";
import { LoginScreen } from "../features/auth/login-screen";
import { useSession } from "../lib/auth/auth-client";

export type RootTabParamList = {
  Home: undefined;
  Jobs: undefined;
  Expenses: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Bottom-tab shell (Home / Jobs / Expenses / Profile — no Timesheet, per
 * the Phase 5 plan's own scoping against Jobber's tab set; Quotes reached
 * from Home/Jobs rather than its own tab until volume justifies one).
 * Native tab bar + native stack transitions (React Navigation, not a
 * custom router) so this reads as a real native app, per the explicit
 * "not a responsive web view" requirement — see docs/spine-prd.md §F11
 * and the approved Phase 5 plan.
 *
 * S-11.1 — branches on session state, not a route: `useSession` (Better
 * Auth's own hook, subscribed to the same store `expoClient` persists
 * to/restores from) is the single source of truth for "is anyone signed
 * in," so this component re-renders automatically the moment
 * `authClient.signIn.email`/`signOut` change it — no manual navigation
 * calls needed on sign-in/sign-out. `isPending` covers the brief window
 * while `expoClient` restores a persisted session from SecureStore on
 * cold start, so a returning user doesn't flash the login screen before
 * their stored session is checked.
 */
export function RootNavigator() {
  const { data: session, isPending } = useSession();
  const { resolvedMode } = useTheme();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
      <Tab.Navigator screenOptions={spineTabBarScreenOptions(resolvedMode)}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarIcon: (props) => <TabBarIcon name="home" {...props} /> }}
        />
        <Tab.Screen
          name="Jobs"
          component={JobsScreen}
          options={{ tabBarIcon: (props) => <TabBarIcon name="briefcase" {...props} /> }}
        />
        <Tab.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{ tabBarIcon: (props) => <TabBarIcon name="dollar-sign" {...props} /> }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarIcon: (props) => <TabBarIcon name="user" {...props} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
