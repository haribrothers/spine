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

export const DECLINE_OFFLINE = "Needs a connection — declining can't be saved offline.";
export const REASON_PLACEHOLDER = "For example, the price or the timing";

/** "Harborview Construction Co. is declining QUO-0004 for $601.16. Riverstone Builders' office is told straight away." */
export function declineMessage(customer: string, number: string, total: string, business: string): string {
  return `${customer} is declining ${number} for ${total}. ${possessive(business)} office is told straight away.`;
}

/**
 * US-MOB-16 · `MobQuoteDecline` / `MobQuoteDeclineAndroid` — a sheet over
 * the quote: who's declining what, an optional reason and a destructive
 * "Decline quote". It needs a connection; offline it says so and the
 * button stays off.
 */
export function DeclineSheet({ quote, onCancel, onDeclined }: { quote: PresentedQuote; onCancel: () => void; onDeclined: () => void }) {
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
      if (error instanceof OfflineError) Alert.alert("No connection", DECLINE_OFFLINE);
      else if (error instanceof ApiError && (error.status === 410 || error.status === 404)) Alert.alert("This quote was already answered", "Go back to the job to see what's changed.");
      else Alert.alert("Couldn't record the decline", "Nothing was saved. Try again.");
    }
  };

  return (
    <ScrollView testID="quote-decline-sheet" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-surface dark:bg-surface-dark" contentContainerClassName="gap-4 px-5 pb-8 pt-4">
      {android ? (
        <Text accessibilityRole="header" className="text-[24px] text-on-surface dark:text-on-surface-dark">
          Decline quote
        </Text>
      ) : null}
      <Text testID="decline-message" className="text-[17px] leading-6 text-on-surface dark:text-on-surface-dark">
        {declineMessage(quote.contactName ?? "The customer", quote.number ?? "this quote", total, quote.business.name)}
      </Text>
      {android ? (
        <OutlinedTextField testID="decline-reason" label="Reason (optional)" placeholder={REASON_PLACEHOLDER} value={reason} onChangeText={setReason} multiline labelBackgroundClassName="bg-surface dark:bg-surface-dark" />
      ) : (
        <View className="gap-2">
          <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">Reason (optional)</Text>
          <TextInput
            testID="decline-reason"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder={REASON_PLACEHOLDER}
            placeholderTextColor={colors.onSurfaceMuted}
            accessibilityLabel="Reason (optional)"
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
            <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Cancel</Text>
          </Pressable>
          <Pressable
            testID="decline-confirm"
            onPress={() => void decline()}
            disabled={!online || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !online || saving, busy: saving }}
            className={`min-h-[48px] justify-center rounded-full bg-overdue px-6 dark:bg-overdue-dark ${!online || saving ? "opacity-40" : ""}`}
          >
            <Text className="text-[16px] font-semibold text-on-danger dark:text-on-danger-dark">Decline quote</Text>
          </Pressable>
        </View>
      ) : (
        <View className="pt-4">
          <FullWidthButton testID="decline-confirm" variant="danger" label={saving ? "Declining…" : "Decline quote"} onPress={() => void decline()} disabled={!online || saving} />
        </View>
      )}
    </ScrollView>
  );
}
