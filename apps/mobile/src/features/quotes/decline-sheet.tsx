import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { FullWidthButton, OutlinedTextField, useNativeColors } from "@spine/ui-native";
import { declineQuote, forgetPresented, presentation, type PresentedQuote } from "../../lib/data/quotes";
import { useSession } from "../../lib/session/session-provider";
import { useOnline } from "../../lib/connectivity";
import { ApiError, OfflineError } from "../../lib/api/errors";
import { money } from "../../lib/format";
import { useBusinessFormat } from "../../lib/data/business";
import { possessive } from "./quote-format";
import { t as translate, useT } from "../../lib/i18n";

export const DECLINE_OFFLINE = translate("mobileWork.decline.offline");
export const REASON_PLACEHOLDER = translate("mobileWork.decline.reasonPlaceholder");

/** "Harborview Construction Co. is declining QUO-0004 for $601.16. Riverstone Builders' office is told straight away." */
export function declineMessage(customer: string, number: string, total: string, business: string): string {
  return translate("mobileWork.decline.message", { customer, number, total, business: possessive(business) });
}

/**
 * US-MOB-16 · `MobQuoteDecline` / `MobQuoteDeclineAndroid` — a sheet over
 * the quote: who's declining what, an optional reason and a destructive
 * "Decline quote". It needs a connection; offline it says so and the
 * button stays off.
 */
export function DeclineSheet({ quote, onCancel, onDeclined }: { quote: PresentedQuote; onCancel: () => void; onDeclined: () => void }) {
  const t = useT();
  const android = Platform.OS === "android";
  const colors = useNativeColors();
  const online = useOnline();
  const { request } = useSession();
  const { locale } = useBusinessFormat();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const total = money(quote.totalAmount, { currency: quote.currency, locale });

  const decline = async () => {
    if (!online || saving) return;
    setSaving(true);
    try {
      await declineQuote(request, quote.id, reason);
      await forgetPresented(presentation.get(quote.id)?.jobId, quote.id);
      onDeclined();
    } catch (error) {
      setSaving(false);
      if (error instanceof OfflineError) Alert.alert(t("mobileWork.decline.noConnection"), DECLINE_OFFLINE);
      else if (error instanceof ApiError && (error.status === 410 || error.status === 404)) Alert.alert(t("mobileWork.common.alreadyAnsweredTitle"), t("mobileWork.common.alreadyAnsweredMessage"));
      else Alert.alert(t("mobileWork.decline.failedTitle"), t("mobileWork.decline.failedMessage"));
    }
  };

  return (
    <ScrollView testID="quote-decline-sheet" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-surface dark:bg-surface-dark" contentContainerClassName="gap-4 px-5 pb-8 pt-4">
      {android ? (
        <Text accessibilityRole="header" className="text-[24px] text-on-surface dark:text-on-surface-dark">
          {t("mobileWork.decline.title")}
        </Text>
      ) : null}
      <Text testID="decline-message" className="text-[17px] leading-6 text-on-surface dark:text-on-surface-dark">
        {declineMessage(quote.contactName ?? t("mobileWork.decline.theCustomer"), quote.number ?? t("mobileWork.decline.thisQuote"), total, quote.business.name)}
      </Text>
      {android ? (
        <OutlinedTextField testID="decline-reason" label={t("mobileWork.decline.reason")} placeholder={REASON_PLACEHOLDER} value={reason} onChangeText={setReason} multiline labelBackgroundClassName="bg-surface dark:bg-surface-dark" />
      ) : (
        <View className="gap-2">
          <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.decline.reason")}</Text>
          <TextInput
            testID="decline-reason"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder={REASON_PLACEHOLDER}
            placeholderTextColor={colors.onSurfaceMuted}
            accessibilityLabel={t("mobileWork.decline.reason")}
            className="min-h-[88px] rounded-xl border border-border bg-background px-4 py-3 text-[16px] text-on-surface dark:border-border-dark dark:bg-background-dark dark:text-on-surface-dark"
            style={{ textAlignVertical: "top" }}
          />
        </View>
      )}
      {online ? null : (
        <View testID="decline-offline" className="flex-row items-center gap-3 rounded-xl bg-due-soon-bg px-4 py-3 dark:bg-due-soon-bg-dark">
          <WifiOff size={20} color={colors.dueSoon} />
          <Text className="flex-1 text-[14px] text-on-surface dark:text-on-surface-dark">{DECLINE_OFFLINE}</Text>
        </View>
      )}
      {android ? (
        <View className="flex-row items-center justify-end gap-6 pt-4">
          <Pressable testID="decline-cancel" onPress={onCancel} accessibilityRole="button" className="min-h-[44px] justify-center">
            <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">{t("mobileWork.common.cancel")}</Text>
          </Pressable>
          <Pressable
            testID="decline-confirm"
            onPress={() => void decline()}
            disabled={!online || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !online || saving, busy: saving }}
            className={`min-h-[48px] justify-center rounded-full bg-overdue px-6 dark:bg-overdue-dark ${!online || saving ? "opacity-40" : ""}`}
          >
            <Text className="text-[16px] font-semibold text-on-danger dark:text-on-danger-dark">{t("mobileWork.decline.title")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="pt-4">
          <FullWidthButton testID="decline-confirm" variant="danger" label={saving ? t("mobileWork.decline.declining") : t("mobileWork.decline.title")} onPress={() => void decline()} disabled={!online || saving} />
        </View>
      )}
    </ScrollView>
  );
}
