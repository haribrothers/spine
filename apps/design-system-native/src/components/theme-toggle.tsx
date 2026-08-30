import { Pressable, Text } from "react-native";
import { useTheme, type ThemePreference } from "@spine/ui-native";

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

/** Cycles light -> dark -> system, placed in the navigator header so every screen can flip theme. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => setPreference(NEXT[preference])} className="px-3 py-1.5">
      <Text className="text-[13px] font-medium text-primary">{preference}</Text>
    </Pressable>
  );
}
