import { Linking, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import Download from "lucide-react-native/icons/download";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import { CLIENT_TOO_OLD_MESSAGE } from "@spine/shared/mobile";
import { FullWidthButton, useNativeColors } from "@spine/ui-native";
import { pendingTotal, usePendingSummary } from "../../lib/outbox/pending";
import { useT } from "../../lib/i18n";

const STORE_LINKS = (Constants.expoConfig?.extra?.storeLinks ?? {}) as { ios?: string; android?: string };

/**
 * US-MOB-10 · `MobUpdateRequired` — any request answered 426 CLIENT_TOO_OLD
 * (D-071). The outbox is kept and sent after the update; the button opens
 * the store listing for this platform.
 */
export function UpdateRequiredScreen() {
  const t = useT();
  const colors = useNativeColors();
  const waiting = pendingTotal(usePendingSummary());
  const isIos = Platform.OS === "ios";
  const storeUrl = isIos ? STORE_LINKS.ios : STORE_LINKS.android;

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-info-bg dark:bg-info-bg-dark">
          <Download size={32} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" className="mt-2 text-center text-[26px] font-bold text-on-surface dark:text-on-surface-dark">
          {CLIENT_TOO_OLD_MESSAGE}
        </Text>
        <Text className="text-center text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {t("mobileApp.updateRequired.message")}
        </Text>
        {waiting > 0 ? (
          <View className="mt-2 flex-row items-start gap-3 rounded-lg bg-due-soon-bg px-4 py-3 dark:bg-due-soon-bg-dark">
            <CloudUpload size={20} color={colors.dueSoon} />
            <Text className="flex-1 text-[13px] text-on-surface dark:text-on-surface-dark">
              {t("mobileApp.updateRequired.waiting", { count: waiting })}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="px-6 pb-6">
        <FullWidthButton
          label={isIos ? t("mobileApp.updateRequired.openAppStore") : t("mobileApp.updateRequired.openGooglePlay")}
          disabled={!storeUrl}
          onPress={() => storeUrl && void Linking.openURL(storeUrl)}
          testID="update-open-store"
        />
      </View>
    </SafeAreaView>
  );
}
