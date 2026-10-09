import { Platform } from "react-native";

/**
 * A card's surface: iOS a white card with a hairline border; Android
 * Material 3's filled card — surface-container, no border (US-MOB-20,
 * `MobHomeAndroid`).
 */
export const CARD = Platform.OS === "android" ? "bg-surface-container dark:bg-surface-container-dark" : "border border-border bg-surface dark:border-border-dark dark:bg-surface-dark";
