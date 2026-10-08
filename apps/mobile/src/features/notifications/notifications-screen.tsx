import { useCallback, useMemo } from "react";
import { Platform, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import AlarmClock from "lucide-react-native/icons/alarm-clock";
import Bell from "lucide-react-native/icons/bell";
import BellOff from "lucide-react-native/icons/bell-off";
import CalendarPlus from "lucide-react-native/icons/calendar-plus";
import CalendarX from "lucide-react-native/icons/calendar-x";
import CircleCheck from "lucide-react-native/icons/circle-check";
import HardHat from "lucide-react-native/icons/hard-hat";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { cache } from "../../lib/cache/cache-store";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useSession } from "../../lib/session/session-provider";
import { useBusinessFormat } from "../../lib/data/business";
import { NOTIFICATIONS_KEY, NOTIFICATIONS_PATH, routeForLink, splitByRead, UNREAD_KEY, type AppNotification } from "../../lib/data/notifications";
import { newIdempotencyKey } from "../../lib/api/idempotency";
import { relativeTime } from "../../lib/format";
import { ListRowsSkeleton } from "../../components/skeletons";

export const NOTIFICATIONS_EMPTY_TITLE = "You're all caught up";
export const NOTIFICATIONS_EMPTY_MESSAGE = "Expense decisions, crew changes and meeting invitations show up here.";

type Tone = "primary" | "paid" | "dueSoon" | "overdue" | "draft";
const TONE_BOX: Record<Tone, string> = {
  primary: "bg-info-bg dark:bg-info-bg-dark",
  paid: "bg-paid-bg dark:bg-paid-bg-dark",
  dueSoon: "bg-due-soon-bg dark:bg-due-soon-bg-dark",
  overdue: "bg-overdue-bg dark:bg-overdue-bg-dark",
  draft: "bg-draft-bg dark:bg-draft-bg-dark",
};

/** The icon and tint per notification type, as drawn. */
export function notificationIcon(type: string): { icon: React.ComponentType<{ size?: number; color?: string }>; tone: Tone } {
  switch (type) {
    case "expense_rejected":
      return { icon: ReceiptText, tone: "overdue" };
    case "expense_approved":
      return { icon: CircleCheck, tone: "paid" };
    case "crew_assigned":
      return { icon: HardHat, tone: "primary" };
    case "crew_removed":
      return { icon: HardHat, tone: "draft" };
    case "meeting_invited":
    case "meeting_response_changed":
      return { icon: CalendarPlus, tone: "primary" };
    case "meeting_starting_soon":
      return { icon: AlarmClock, tone: "dueSoon" };
    case "meeting_cancelled":
    case "meeting_removed":
      return { icon: CalendarX, tone: "overdue" };
    default:
      return { icon: Bell, tone: "primary" };
  }
}

/**
 * US-MOB-22 · `MobNotifications`, `MobNotificationsEmpty` (and Android) —
 * "NEW" and "EARLIER", each with an icon, the message, a detail line and a
 * time; unread carry a dot (iOS) or a tinted row (Android). Tapping one
 * marks it read and opens its expense, job or meeting; "Read all" marks
 * every one read. Refreshes on open, on return to the app and on pull
 * (no push in 1.0, D-200).
 */
export function NotificationsScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const { request } = useSession();
  const { locale } = useBusinessFormat();
  const list = useCachedQuery<AppNotification[]>(NOTIFICATIONS_KEY, NOTIFICATIONS_PATH, { refreshOnForeground: true });
  const items = useMemo(() => list.data ?? [], [list.data]);
  const { fresh, earlier } = splitByRead(items);
  const android = Platform.OS === "android";
  const now = new Date();

  const markLocally = useCallback(
    async (ids: string[] | "all") => {
      const readAt = new Date().toISOString();
      const next = items.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? readAt } : n));
      await cache.write(NOTIFICATIONS_KEY, next);
      await cache.write(UNREAD_KEY, { count: next.filter((n) => !n.readAt).length });
    },
    [items],
  );

  const readAll = useCallback(async () => {
    await markLocally("all");
    try {
      await request("POST", "/notifications/read-all", { body: {}, idempotencyKey: newIdempotencyKey() });
    } catch {
      // Marked on the phone; the next refresh catches up.
    }
  }, [markLocally, request]);

  const openOne = async (item: AppNotification) => {
    if (!item.readAt) {
      await markLocally([item.id]);
      void request("POST", `/notifications/${item.id}/read`, { body: {}, idempotencyKey: newIdempotencyKey() }).catch(() => undefined);
    }
    const route = routeForLink(item.link);
    if (route) router.push(route);
  };

  const sections = [
    ...(fresh.length ? [{ key: "new", title: "New", data: fresh }] : []),
    ...(earlier.length ? [{ key: "earlier", title: "Earlier", data: earlier }] : []),
  ];

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Stack.Screen
        options={
          android
            ? {
                title: "Notifications",
                headerRight: () =>
                  fresh.length ? (
                    <Pressable testID="notifications-read-all" onPress={() => void readAll()} accessibilityRole="button" hitSlop={10} className="min-h-[44px] justify-center px-2">
                      <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Read all</Text>
                    </Pressable>
                  ) : null,
              }
            : {
                title: "Notifications",
                unstable_headerRightItems: () => (fresh.length ? [{ type: "button" as const, label: "Read all", onPress: () => void readAll() }] : []),
              }
        }
      />
      <SectionList
        testID="notifications-list"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName={android ? "pb-16" : "px-4 pb-16"}
        contentContainerStyle={items.length === 0 && list.data ? { flexGrow: 1, justifyContent: "center" } : undefined}
        sections={sections}
        stickySectionHeadersEnabled={false}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.onSurfaceMuted} />}
        renderSectionHeader={({ section }) => (
          <Text
            testID={`notifications-${section.key}`}
            accessibilityRole="header"
            className={android ? "px-4 pb-2 pt-4 text-[15px] font-medium text-primary dark:text-primary-dark" : "px-1 pb-2 pt-4 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark"}
          >
            {android ? section.title : section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item, index, section }) => {
          const { icon: Icon, tone } = notificationIcon(item.type);
          const unread = !item.readAt;
          const first = index === 0;
          const last = index === section.data.length - 1;
          const shape = android
            ? unread
              ? "bg-info-bg dark:bg-info-bg-dark"
              : ""
            : `bg-surface dark:bg-surface-dark ${first ? "rounded-t-2xl" : "border-t border-border dark:border-border-dark"} ${last ? "rounded-b-2xl" : ""}`;
          const color = { primary: colors.primary, paid: colors.paid, dueSoon: colors.dueSoon, overdue: colors.overdue, draft: colors.onSurfaceMuted }[tone];
          const time = relativeTime(item.createdAt, locale, now, android);
          return (
            <Pressable
              testID={`notification-${item.id}`}
              onPress={() => void openOne(item)}
              accessibilityRole="button"
              accessibilityLabel={[unread ? "Unread" : null, item.message, item.detail, time].filter(Boolean).join(", ")}
              className={`flex-row items-start gap-3 px-4 py-3.5 active:opacity-80 ${shape}`}
            >
              <View className={`h-11 w-11 items-center justify-center rounded-xl ${TONE_BOX[tone]}`}>
                <Icon size={20} color={color} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className={`text-[16px] text-on-surface dark:text-on-surface-dark ${android ? "" : "font-semibold"}`}>{item.message}</Text>
                {item.detail ? <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{item.detail}</Text> : null}
                {android ? null : <Text className="pt-0.5 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{time}</Text>}
              </View>
              {android ? <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{time}</Text> : unread ? <View testID={`notification-dot-${item.id}`} className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary-dark" /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          list.loading ? (
            <View className={android ? "" : "pt-4"}>
              <ListRowsSkeleton label="Loading notifications" testID="skeleton-notifications" rows={5} leading />
            </View>
          ) : list.data ? (
            <EmptyState
              testID="notifications-empty"
              icon={
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-draft-bg dark:bg-draft-bg-dark">
                  <BellOff size={30} color={colors.onSurfaceMuted} />
                </View>
              }
              title={NOTIFICATIONS_EMPTY_TITLE}
              description={NOTIFICATIONS_EMPTY_MESSAGE}
            />
          ) : null
        }
      />
    </View>
  );
}
