import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ExpensesScreen } from "../features/expenses/expenses-screen";
import { HomeScreen } from "../features/home/home-screen";
import { JobsScreen } from "../features/jobs/jobs-screen";
import { ProfileScreen } from "../features/profile/profile-screen";

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
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Jobs" component={JobsScreen} />
        <Tab.Screen name="Expenses" component={ExpensesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
