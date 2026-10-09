import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Check from "lucide-react-native/icons/check";
import { FullWidthButton, useNativeColors } from "@spine/ui-native";
import type { PresentedQuote } from "../../lib/data/quotes";
import { money } from "../../lib/format";
import { useBusinessFormat } from "../../lib/data/business";
import { possessive, timeLabel } from "./quote-format";

export const METHOD_ON_PHONE = "In person, on this phone";

/** "Signed by Alan Reyes at 10:42 AM. Riverstone Builders' office has been told and the quote is now locked." */
export function acceptedMessage(signer: string, at: string, business: string): string {
  return `Signed by ${signer} at ${at}. ${possessive(business)} office has been told and the quote is now locked.`;
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between gap-3 px-4 py-3.5 ${last ? "" : "border-b border-border dark:border-border-dark"}`}>
      <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
      <Text className="flex-1 text-right text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{value}</Text>
    </View>
  );
}

/**
 * US-MOB-17 · `MobQuoteAccepted` / `MobQuoteAcceptedAndroid` — the answer
 * the server recorded: who signed and when, that the office was told and
 * the quote is locked, the witness and the method. "Back to job" closes
 * the presentation.
 */
export function AcceptedScreen({ quote, onDone }: { quote: PresentedQuote; onDone: () => void }) {
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const { locale } = useBusinessFormat();
  const android = Platform.OS === "android";
  const total = money(quote.totalAmount, { currency: quote.currency, locale });
  const at = quote.respondedAt ? timeLabel(quote.respondedAt, locale) : "";
  return (
    <View testID="quote-accepted" className="flex-1 bg-background px-4 dark:bg-background-dark" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
      <View className="flex-1 justify-center gap-6">
        <View className="items-center gap-3">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-paid-bg dark:bg-paid-bg-dark">
            <Check size={36} color={colors.paid} />
          </View>
          <Text accessibilityRole="header" className={`text-center text-[28px] text-on-surface dark:text-on-surface-dark ${android ? "" : "font-bold"}`}>
            Quote accepted
          </Text>
          <Text className="text-center text-[17px] font-semibold text-on-surface dark:text-on-surface-dark">
            {quote.number} · {total}
          </Text>
          <Text testID="accepted-message" className="px-4 text-center text-[15px] leading-[22px] text-on-surface-muted dark:text-on-surface-muted-dark">
            {acceptedMessage(quote.acceptedSignerName ?? "the customer", at, quote.business.name)}
          </Text>
        </View>
        <View className={`overflow-hidden rounded-2xl ${android ? "bg-surface-sunken dark:bg-surface-sunken-dark" : "bg-surface dark:bg-surface-dark"}`}>
          <InfoRow label="Customer" value={quote.contactName ?? "—"} />
          <InfoRow label="Witnessed by" value={quote.acceptedByName ?? "—"} />
          <InfoRow label="Method" value={METHOD_ON_PHONE} last />
        </View>
      </View>
      <FullWidthButton testID="accepted-back" label="Back to job" onPress={onDone} />
    </View>
  );
}
