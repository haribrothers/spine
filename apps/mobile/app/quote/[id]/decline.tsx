import { Platform } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { presentation } from "../../../src/lib/data/quotes";
import { DeclineSheet } from "../../../src/features/quotes/decline-sheet";
import { useCloseQuote } from "../../../src/features/quotes/use-close-quote";
import { useT } from "../../../src/lib/i18n";

export default function DeclineQuote() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useNativeColors();
  const close = useCloseQuote(id);
  const quote = presentation.get(id)?.quote;
  if (!quote) return null;
  return (
    <>
      {Platform.OS === "ios" ? (
        <Stack.Screen options={{ unstable_headerLeftItems: () => [{ type: "button" as const, label: t("mobileWork.common.cancel"), tintColor: colors.onSurface, onPress: () => router.back() }] }} />
      ) : null}
      <DeclineSheet quote={quote} onCancel={() => router.back()} onDeclined={close} />
    </>
  );
}
