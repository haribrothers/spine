import { useCallback, useEffect, useState } from "react";
import { Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useNavigation } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { ProfileAvatarButton } from "../../components/header-items";
import { SyncPill } from "../../components/sync-pill";
import { BellButton } from "../../components/bell-button";

/** How far Today scrolls before the large title has gone under the bar. */
const COLLAPSE_AT = 40;

/** Android's large "Today" at the top of the page (Material 3's large top app bar). */
export function TodayLargeTitle() {
  return (
    <Text accessibilityRole="header" testID="today-large-title" className="-mb-2 -mt-2 text-[32px] text-on-surface dark:text-on-surface-dark">
      Today
    </Text>
  );
}

/**
 * US-MOB-20 · `MobHomeAndroid` / `MobHomeJobsAndroid` — Today's Material 3
 * large top app bar: at the top the bar carries the sync pill on the left
 * and the bell and avatar on the right, with "Today" large below it;
 * scrolled, the bar takes the small title, moves the pill beside the bell
 * and turns surface-container (Material's on-scroll colour).
 */
export function useTodayAndroidHeader(enabled: boolean) {
  const colors = useNativeColors();
  const [collapsed, setCollapsed] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > COLLAPSE_AT;
    setCollapsed((current) => (current === next ? current : next));
  }, []);
  const actions = (withPill: boolean) => (
    <View className="flex-row items-center gap-2">
      {withPill ? <SyncPill /> : null}
      <BellButton />
      <ProfileAvatarButton />
    </View>
  );
  // Set after mount (not with <Stack.Screen>): Today is the first screen, and updating the navigator
  // while it's still mounting is a React warning.
  const navigation = useNavigation();
  useEffect(() => {
    if (!enabled) return;
    navigation.setOptions(
      collapsed
        ? { title: "Today", headerLeft: () => null, headerRight: () => actions(true), headerStyle: { backgroundColor: colors.surfaceContainer } }
        : { title: "", headerLeft: () => <SyncPill />, headerRight: () => actions(false), headerStyle: { backgroundColor: colors.background } },
    );
  }, [enabled, navigation, collapsed, colors]);
  return { collapsed, onScroll };
}
