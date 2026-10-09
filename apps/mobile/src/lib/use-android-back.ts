import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * US-MOB-20 — Android's back gesture does what the screen's drawn back
 * arrow or ✕ does: the camera asks before discarding photos, a form drops
 * the receipt it kept, Search leaves the search. Only while the screen is
 * focused and `enabled`; iOS is unaffected.
 */
export function useAndroidBack(handler: () => void, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !enabled) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        latest.current();
        return true;
      });
      return () => subscription.remove();
    }, [enabled]),
  );
}
