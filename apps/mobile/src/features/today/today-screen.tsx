import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import CloudOff from "lucide-react-native/icons/cloud-off";
import { Skeleton, useNativeColors } from "@spine/ui-native";
import { useSession, useSignedInSession } from "../../lib/session/session-provider";
import { OfflineError, ServerUnreachableError } from "../../lib/api/errors";
import type { Member } from "../../lib/session/sign-in";
import { greeting } from "../../lib/member-display";
import { ServerErrorState } from "../errors/server-error-state";

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "offline" } | { kind: "unreachable" };

/**
 * Today — Group 1 builds the frame: the large title with the avatar, the
 * welcome card and the load states. "Couldn't load your jobs" (US-MOB-10)
 * shows when the phone is online but the server doesn't answer; the saved
 * jobs link appears once there's a cache (US-MOB-07). The gauge, KPI cards,
 * quick actions and jobs arrive with US-MOB-03 (Group 2).
 */
export function TodayScreen() {
  const colors = useNativeColors();
  const { request } = useSession();
  const { member } = useSignedInSession();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      await request<Member>("GET", "/org/members/me");
      setLoad({ kind: "ready" });
    } catch (error) {
      if (error instanceof OfflineError) setLoad({ kind: "offline" });
      else if (error instanceof ServerUnreachableError) setLoad({ kind: "unreachable" });
      else setLoad({ kind: "ready" });
    }
  }, [request]);

  useEffect(() => {
    void fetchToday();
  }, [fetchToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchToday();
    setRefreshing(false);
  }, [fetchToday]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-5 px-4 pb-32 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurfaceMuted} />}
    >
      {load.kind === "unreachable" ? (
        <ServerErrorState
          onRetry={() => {
            setLoad({ kind: "loading" });
            void fetchToday();
          }}
        />
      ) : (
        <>
          {load.kind === "offline" ? (
            <View accessibilityRole="alert" className="flex-row items-start gap-3 rounded-lg bg-draft-bg px-4 py-3.5 dark:bg-draft-bg-dark">
              <CloudOff size={20} color={colors.onSurfaceMuted} />
              <View className="flex-1 gap-1">
                <Text className="text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">{"You're offline"}</Text>
                <Text className="text-[13px] text-on-surface dark:text-on-surface-dark">{"Connect to Wi-Fi or mobile data to load today's jobs."}</Text>
              </View>
            </View>
          ) : null}
          <View testID="today-welcome" className="gap-1 rounded-[20px] bg-surface-sunken p-5 dark:bg-surface-sunken-dark">
            <Text className="text-[26px] font-semibold text-on-surface dark:text-on-surface-dark">{greeting(member)}</Text>
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
              {member.organizationName} · {today}
            </Text>
            {load.kind === "loading" ? <Skeleton className="mt-4 h-24 w-full rounded-lg" /> : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
