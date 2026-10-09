import { Platform } from "react-native";

/**
 * US-MOB-20 — Material 3's top app bar on Android: the page's colour and
 * flat, with no shadow line under it (React Navigation's default draws an
 * elevation shadow). iOS keeps its native header.
 */
export function androidHeaderOptions(colors: { background: string }) {
  return Platform.OS === "android" ? { headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false } : {};
}
