import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../../app/home";
import { ComponentDetailScreen } from "../../app/component-detail";
import { COMPONENT_REGISTRY } from "../lib/component-registry";
import { ThemeToggle } from "../components/theme-toggle";

export type RootStackParamList = {
  Home: undefined;
  Component: { slug: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerRight: () => <ThemeToggle /> }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "@spine/ui-native" }} />
        <Stack.Screen
          name="Component"
          component={ComponentDetailScreen}
          options={({ route }) => ({
            title: COMPONENT_REGISTRY.find((entry) => entry.slug === route.params.slug)?.name ?? route.params.slug,
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
