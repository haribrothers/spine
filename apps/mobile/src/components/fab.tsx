import { Pressable, Text } from "react-native";
import { useNativeColors } from "@spine/ui-native";

type Icon = React.ComponentType<{ size?: number; color?: string }>;

/**
 * Android's extended floating action button (D-197): "Add photos" on a job
 * and its photos, "Log expense" on Expenses. Material 3's tonal FAB —
 * primary-container with on-primary-container (US-MOB-20).
 */
export function Fab({ label, icon: Icon, onPress, testID }: { label: string; icon: Icon; onPress: () => void; testID?: string }) {
  const colors = useNativeColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="absolute bottom-6 right-4 h-14 flex-row items-center gap-3 rounded-2xl bg-primary-container px-5 shadow-md active:opacity-80 dark:bg-primary-container-dark"
    >
      <Icon size={22} color={colors.onPrimaryContainer} />
      <Text className="text-[16px] font-semibold text-on-primary-container dark:text-on-primary-container-dark">{label}</Text>
    </Pressable>
  );
}
