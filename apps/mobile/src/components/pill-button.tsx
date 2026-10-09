import { Platform, Pressable, Text } from "react-native";
import { useNativeColors } from "@spine/ui-native";

type Icon = React.ComponentType<{ size?: number; color?: string }>;

/**
 * The tinted pill on job cards and rows ("Call Alan Reyes", "Directions",
 * "Present"): primary text on the info tint on iOS, Material 3's tonal
 * button (primary-container) on Android (US-MOB-20); `outlined` is
 * Android's secondary pill. At least 44pt tall.
 */
export function PillButton({ label, icon: Icon, onPress, outlined = false, accessibilityLabel, testID, grow = false }: { label: string; icon?: Icon; onPress: () => void; outlined?: boolean; accessibilityLabel?: string; testID?: string; grow?: boolean }) {
  const colors = useNativeColors();
  const tonal = !outlined && Platform.OS === "android";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full px-4 active:opacity-70 ${
        outlined ? "border border-border-strong dark:border-border-strong-dark" : tonal ? "bg-primary-container dark:bg-primary-container-dark" : "bg-info-bg dark:bg-info-bg-dark"
      } ${grow ? "flex-1" : ""}`}
    >
      {Icon ? <Icon size={18} color={tonal ? colors.onPrimaryContainer : colors.primary} /> : null}
      <Text numberOfLines={1} className={`text-[15px] font-semibold ${tonal ? "text-on-primary-container dark:text-on-primary-container-dark" : "text-primary dark:text-primary-dark"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
