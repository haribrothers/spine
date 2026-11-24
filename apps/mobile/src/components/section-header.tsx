import { Platform, Pressable, Text, View } from "react-native";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import { useNativeColors } from "@spine/ui-native";

/**
 * A list section's title: "MILESTONES" (iOS, muted capitals) or
 * "Milestones" (Android, the primary colour), with an optional count
 * ("PHOTOS · 12") and action ("See all", "All jobs ↗").
 */
export function SectionHeader({ title, count, action, testID }: { title: string; count?: number; action?: { label: string; onPress: () => void; arrow?: boolean }; testID?: string }) {
  const colors = useNativeColors();
  const ios = Platform.OS === "ios";
  const text = `${title}${count !== undefined ? ` · ${count}` : ""}`;
  return (
    <View className="flex-row items-center justify-between px-1" testID={testID}>
      <Text
        accessibilityRole="header"
        className={
          ios
            ? "text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark"
            : "text-[15px] font-medium text-primary dark:text-primary-dark"
        }
      >
        {ios ? text.toUpperCase() : text}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={action.label} className="min-h-[44px] flex-row items-center justify-end gap-1">
          <Text className="text-[15px] font-medium text-primary dark:text-primary-dark">{action.label}</Text>
          {action.arrow ? <ArrowUpRight size={15} color={colors.primary} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
