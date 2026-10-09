import { View } from "react-native";
import ServerCrash from "lucide-react-native/icons/server-crash";
import { Button, EmptyState, useNativeColors } from "@spine/ui-native";

export const SERVER_ERROR_TITLE = "Couldn't load your jobs";
export const SERVER_ERROR_MESSAGE = "The Spine server didn't answer. You're online, so it may be restarting — try again in a minute.";

/**
 * US-MOB-10 · `MobError` — the phone is online but the server didn't answer.
 * "Show jobs saved at <time>" appears only when there's a cache to show.
 */
export function ServerErrorState({ onRetry, savedAt, onShowSaved }: { onRetry: () => void; savedAt?: string | null; onShowSaved?: () => void }) {
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
          <Button label="Try again" onPress={onRetry} testID="server-error-retry" />
          {savedAt && onShowSaved ? <Button variant="ghost" label={`Show jobs saved at ${savedAt}`} onPress={onShowSaved} testID="server-error-saved" /> : null}
        </View>
      }
    />
  );
}
