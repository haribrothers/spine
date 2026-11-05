import { View } from "react-native";
import ServerCrash from "lucide-react-native/icons/server-crash";
import { Button, EmptyState, useNativeColors } from "@spine/ui-native";
import { t as translate, useT } from "../../lib/i18n";

export const SERVER_ERROR_TITLE = translate("mobileApp.serverError.title");
export const SERVER_ERROR_MESSAGE = translate("mobileApp.serverError.message");

/**
 * US-MOB-10 · `MobError` — the phone is online but the server didn't answer.
 * "Show jobs saved at <time>" appears only when there's a cache to show.
 */
export function ServerErrorState({ onRetry, savedAt, onShowSaved }: { onRetry: () => void; savedAt?: string | null; onShowSaved?: () => void }) {
  const t = useT();
  const colors = useNativeColors();
  return (
    <EmptyState
      testID="server-error"
      icon={
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-overdue-bg dark:bg-overdue-bg-dark">
          <ServerCrash size={32} color={colors.overdue} />
        </View>
      }
      title={SERVER_ERROR_TITLE}
      description={SERVER_ERROR_MESSAGE}
      action={
        <View className="items-center gap-2">
          <Button label={t("mobileApp.common.tryAgain")} onPress={onRetry} testID="server-error-retry" />
          {savedAt && onShowSaved ? <Button variant="ghost" label={t("mobileApp.serverError.showSaved", { time: savedAt })} onPress={onShowSaved} testID="server-error-saved" /> : null}
        </View>
      }
    />
  );
}
