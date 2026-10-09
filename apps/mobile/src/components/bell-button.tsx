import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import { useNativeColors } from "@spine/ui-native";
import { badgeText, UNREAD_KEY, UNREAD_PATH } from "../lib/data/notifications";
import { useCachedQuery } from "../lib/data/use-cached-query";

/**
 * US-MOB-22 — the bell on Today with the unread count ("9+" above nine);
 * opens Notifications. Refreshes when the app comes back to the
 * foreground (no push in 1.0, D-200).
 */
export function BellButton() {
  const router = useRouter();
  const colors = useNativeColors();
  const { data } = useCachedQuery<{ count: number }>(UNREAD_KEY, UNREAD_PATH, { refreshOnForeground: true });
  const count = data?.count ?? 0;
  const badge = badgeText(count);
  return (
    <Pressable
      testID="today-bell"
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="h-11 w-11 items-center justify-center"
    >
      <Bell size={22} color={colors.onSurface} />
      {badge ? (
        <View className="absolute right-0.5 top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-overdue px-1 dark:bg-overdue-dark">
          <Text className="text-[11px] font-bold text-on-danger dark:text-on-danger-dark">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
