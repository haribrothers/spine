import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import WifiOff from "lucide-react-native/icons/wifi-off";
import X from "lucide-react-native/icons/x";
import { useNativeColors } from "@spine/ui-native";
import { t as translate, useT } from "../../lib/i18n";

export const NEEDS_CONNECTION_TITLE = translate("mobileWork.needsConnection.title");
export const NEEDS_CONNECTION_MESSAGE = translate("mobileWork.needsConnection.message");
export const STILL_OFFLINE_NOTE = translate("mobileWork.needsConnection.stillOffline");

/**
 * US-MOB-18 · `MobQuoteNeedsConnectionAndroid` — Android says it in an
 * alert dialog over the job; "Try again" checks again.
 */
export function alertNeedsConnection(onTryAgain: () => void) {
  Alert.alert(NEEDS_CONNECTION_TITLE, `${NEEDS_CONNECTION_MESSAGE}\n\n${STILL_OFFLINE_NOTE}`, [
    { text: translate("mobileWork.common.backToJob"), style: "cancel" },
    { text: translate("mobileWork.common.tryAgain"), onPress: onTryAgain },
  ]);
}

/**
 * US-MOB-18 · `MobQuoteNeedsConnection` — what Present shows with no
 * connection (D-050): accepting locks the price, so it can't wait in the
 * outbox. "Try again" opens the quote once there's signal.
 */
export function NeedsConnection({ onTryAgain, onBack, checking = false }: { onTryAgain: () => void; onBack: () => void; checking?: boolean }) {
  const t = useT();
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  return (
    <View testID="quote-needs-connection" className="flex-1 bg-background px-6 dark:bg-background-dark" style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t("mobileWork.common.close")} hitSlop={8} className="h-11 w-11 items-center justify-center rounded-full bg-surface dark:bg-surface-dark">
        <X size={20} color={colors.onSurface} />
      </Pressable>
      <View className="flex-1 items-center justify-center gap-3">
        <View className="mb-2 h-16 w-16 items-center justify-center rounded-2xl bg-due-soon-bg dark:bg-due-soon-bg-dark">
          <WifiOff size={28} color={colors.dueSoon} />
        </View>
        <Text accessibilityRole="header" className="text-center text-[24px] font-bold text-on-surface dark:text-on-surface-dark">
          {NEEDS_CONNECTION_TITLE}
        </Text>
        <Text className="text-center text-[16px] leading-6 text-on-surface-muted dark:text-on-surface-muted-dark">{NEEDS_CONNECTION_MESSAGE}</Text>
        <Text className="mt-3 text-center text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{STILL_OFFLINE_NOTE}</Text>
      </View>
      <View className="gap-2">
        <Pressable
          testID="quote-try-again"
          onPress={onTryAgain}
          disabled={checking}
          accessibilityRole="button"
          accessibilityState={{ disabled: checking, busy: checking }}
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-primary dark:bg-primary-dark"
        >
          <RefreshCw size={18} color={colors.onPrimary} />
          <Text className="text-[17px] font-semibold text-on-primary dark:text-on-primary-dark">{t("mobileWork.common.tryAgain")}</Text>
        </Pressable>
        <Pressable testID="quote-back-to-job" onPress={onBack} accessibilityRole="button" className="min-h-[48px] items-center justify-center">
          <Text className="text-[17px] font-semibold text-primary dark:text-primary-dark">{t("mobileWork.common.backToJob")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
