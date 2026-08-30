import { useState } from "react";
import { Pressable } from "react-native";
import Search from "lucide-react-native/icons/search";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@spine/ui-native";
import { spineDarkNavigationTheme, spineLightNavigationTheme } from "@spine/ui-native/navigation";
import { HomeScreen } from "../../app/home";
import { ComponentDetailScreen } from "../../app/component-detail";
import { COMPONENT_REGISTRY } from "../lib/component-registry";
import { ThemeToggle } from "../components/theme-toggle";
import { SearchPalette } from "../components/search-palette";

export type RootStackParamList = {
  Home: undefined;
  Component: { slug: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SearchButton() {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search components"
        onPress={() => setOpen(true)}
        className="h-8 w-8 items-center justify-center rounded-md active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
      >
        <Search size={18} color="#726C5A" />
      </Pressable>
      <SearchPalette open={open} onOpenChange={setOpen} onSelect={(slug) => navigation.navigate("Component", { slug })} />
    </>
  );
}

export function RootNavigator() {
  const { resolvedMode } = useTheme();

  return (
    <NavigationContainer theme={resolvedMode === "dark" ? spineDarkNavigationTheme : spineLightNavigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerRight: () => (
            <>
              <SearchButton />
              <ThemeToggle />
            </>
          ),
        }}
      >
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
