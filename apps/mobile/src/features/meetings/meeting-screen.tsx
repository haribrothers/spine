import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import MapPin from "lucide-react-native/icons/map-pin";
import { EmptyState, Skeleton, useNativeColors } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useBusinessFormat } from "../../lib/data/business";
import type { Meeting } from "../../lib/data/meetings";
import { weekdayDayMonth } from "../../lib/format";

/**
 * US-MOB-22 — where a meeting notification or Today's next meeting lands:
 * the meeting's title, when and where, and its notes. Read-only; meetings
 * are managed on the web.
 */
export function MeetingScreen({ id }: { id: string }) {
  const colors = useNativeColors();
  const { locale } = useBusinessFormat();
  const meeting = useCachedQuery<Meeting>(`meeting:${id}`, `/meetings/${id}`);
  const m = meeting.data;
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-4 p-4 pb-16">
      <Stack.Screen options={{ title: m?.title ?? "Meeting" }} />
      {m ? (
        <View testID="meeting" className="gap-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Text accessibilityRole="header" className="text-[22px] font-semibold text-on-surface dark:text-on-surface-dark">{m.title}</Text>
          <View className="flex-row items-center gap-3">
            <CalendarClock size={20} color={colors.onSurfaceMuted} />
            <Text className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark">
              {weekdayDayMonth(new Date(m.startAt), locale)}
              {m.allDay ? " · All day" : `, ${time(m.startAt)} – ${time(m.endAt)}`}
            </Text>
          </View>
          {m.location ? (
            <View className="flex-row items-center gap-3">
              <MapPin size={20} color={colors.onSurfaceMuted} />
              <Text className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark">{m.location}</Text>
            </View>
          ) : null}
          {m.description ? <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{m.description}</Text> : null}
        </View>
      ) : meeting.status === "loading" ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <EmptyState title="This meeting isn't available" description="It may have been cancelled, or you're no longer invited." />
      )}
    </ScrollView>
  );
}
