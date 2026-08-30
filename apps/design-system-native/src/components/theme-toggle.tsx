import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, type ThemePreference } from "@spine/ui-native";
import { lightColors, darkColors } from "@spine/ui-native/tokens";

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

/** icon per preference, matching apps/design-system's Sun/Moon icon-button toggle look — this app adds "system" (a monitor icon) as a third state, since ui-native's ThemeProvider is deliberately three-state (see its own doc comment on matching web's light/dark/system precedence exactly). Icon shows the CURRENT preference, not the state you'd switch to: sun = light, moon = dark, monitor = system. */
const ICON_BY_PREFERENCE: Record<ThemePreference, React.ComponentProps<typeof Feather>["name"]> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
};

/** Cycles light -> dark -> system, placed in the navigator header so every screen can flip theme. */
export function ThemeToggle() {
  const { preference, resolvedMode, setPreference } = useTheme();
  const iconColor = resolvedMode === "dark" ? darkColors.onSurfaceMuted : lightColors.onSurfaceMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle theme"
      onPress={() => setPreference(NEXT[preference])}
      className="h-8 w-8 items-center justify-center rounded-md active:bg-surface-sunken"
    >
      <Feather name={ICON_BY_PREFERENCE[preference]} size={18} color={iconColor} />
    </Pressable>
  );
}
