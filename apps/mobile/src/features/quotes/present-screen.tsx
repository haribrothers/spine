import { useEffect } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Hand from "lucide-react-native/icons/hand";
import Signature from "lucide-react-native/icons/signature";
import X from "lucide-react-native/icons/x";
import { useNativeColors } from "@spine/ui-native";
import { presentation, useLiveQuote, type PresentedLine, type PresentedQuote } from "../../lib/data/quotes";
import { useBusinessFormat } from "../../lib/data/business";
import { money } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { CardRowsSkeleton } from "../../components/skeletons";
import { NeedsConnection } from "./needs-connection";
import { htmlToText, quantityLabel, validUntilLabel } from "./quote-format";

export const HAND_OVER = "Hand the phone to your customer";
export const NOT_WAITING = "This quote isn't waiting for the customer any more. Go back to the job to see what's changed.";

function Row({ label, value, strong = false, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View testID={testID} className="flex-row items-baseline justify-between gap-3">
      <Text className={strong ? "text-[20px] font-bold text-on-surface dark:text-on-surface-dark" : "text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark"}>{label}</Text>
      <Text className={strong ? "text-[20px] font-bold text-on-surface dark:text-on-surface-dark" : "text-[15px] text-on-surface dark:text-on-surface-dark"}>{value}</Text>
    </View>
  );
}

function Line({ line, fmt, locale }: { line: PresentedLine; fmt: (minor: string) => string; locale: string }) {
  if (line.type === "heading") return <Text className="pt-1 text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">{line.name}</Text>;
  if (line.type === "text") return <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{line.description ?? line.name}</Text>;
  return (
    <View className="gap-1">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{line.name}</Text>
        <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{fmt(line.lineSubtotalAmount)}</Text>
      </View>
      <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
        {quantityLabel(line.quantity, locale)} × {fmt(line.unitPriceAmount)}
      </Text>
    </View>
  );
}

/** The quote as the customer reads it — the same figures as the PDF, each tax on its own line. */
function QuoteCard({ quote }: { quote: PresentedQuote }) {
  const android = Platform.OS === "android";
  const { locale } = useBusinessFormat();
  const fmt = (minor: string) => money(minor, { currency: quote.currency, locale });
  const discount = BigInt(quote.discountAmount || "0");
  return (
    <View testID="quote-card" className={`gap-4 rounded-2xl bg-surface p-5 dark:bg-surface-dark ${android ? "border border-border-strong dark:border-border-strong-dark" : ""}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[18px] font-bold text-on-surface dark:text-on-surface-dark">{quote.business.name}</Text>
          {quote.business.address ? <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{quote.business.address}</Text> : null}
        </View>
        {android ? null : (
          <View className="items-end">
            <Text className="text-[12px] font-medium uppercase tracking-widest text-on-surface-muted dark:text-on-surface-muted-dark">Quote</Text>
            <Text className="text-[22px] font-bold text-on-surface dark:text-on-surface-dark">{quote.number}</Text>
          </View>
        )}
      </View>
      <View className="flex-row justify-between gap-3 border-t border-border pt-4 dark:border-border-dark">
        <View className="flex-1 gap-0.5">
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Prepared for</Text>
          <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{quote.contactName ?? "—"}</Text>
        </View>
        {quote.validUntil ? (
          <View className="items-end gap-0.5">
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Valid until</Text>
            <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{validUntilLabel(quote.validUntil, locale)}</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-4">
        {quote.lines.map((line) => (
          <Line key={line.id} line={line} fmt={fmt} locale={locale} />
        ))}
      </View>
      <View className="gap-2 border-t border-border pt-4 dark:border-border-dark">
        <Row label="Subtotal" value={fmt(quote.subtotalAmount)} />
        {discount > 0n ? <Row label="Discount" value={fmt((-discount).toString())} /> : null}
        {quote.taxLines.map((tax) => (
          <Row key={tax.label} label={tax.label} value={fmt(tax.amount)} />
        ))}
        <View className="pt-2">
          <Row label="Total" value={fmt(quote.totalAmount)} strong testID="quote-total" />
        </View>
      </View>
    </View>
  );
}

/**
 * US-MOB-16 · `MobQuotePresent` / `MobQuotePresentAndroid` — the quote
 * full-screen, to hand to the customer: always read live (US-MOB-18), with
 * "Decline" and "Accept quote" at the bottom. "Done" (iOS) or ✕ (Android)
 * goes back to the job.
 */
export function PresentScreen({ id, jobId, onClose }: { id: string; jobId?: string; onClose: () => void }) {
  const router = useRouter();
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
  const android = Platform.OS === "android";
  const live = useLiveQuote(id);
  const quote = live.status === "ready" ? live.quote : null;

  useEffect(() => {
    if (quote) presentation.start(quote, jobId);
  }, [quote, jobId]);

  if (live.status === "offline") return <NeedsConnection onTryAgain={live.retry} onBack={onClose} />;

  const handOver = (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-info-bg px-3 py-1.5 dark:bg-info-bg-dark">
      <Hand size={14} color={colors.primary} />
      <Text className="text-[13px] font-medium text-primary dark:text-primary-dark">{HAND_OVER}</Text>
    </View>
  );
  const open = quote && quote.status === "sent";

  return (
    <View testID="quote-present" className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: insets.top }}>
      {android ? (
        <View className="flex-row items-center gap-4 px-2 py-2">
          <Pressable testID="quote-done" onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} className="h-12 w-12 items-center justify-center">
            <X size={24} color={colors.onSurface} />
          </Pressable>
          <Text accessibilityRole="header" className="text-[22px] text-on-surface dark:text-on-surface-dark">
            {quote?.number ?? "Quote"}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-3 px-4 py-2">
          <Pressable testID="quote-done" onPress={onClose} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full bg-surface px-5 dark:bg-surface-dark">
            <Text className="text-[17px] text-on-surface dark:text-on-surface-dark">Done</Text>
          </Pressable>
          {handOver}
        </View>
      )}

      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerClassName="gap-5 px-4 pb-8 pt-2">
        {android ? handOver : null}
        {live.status === "loading" ? <CardRowsSkeleton rows={6} label="Loading the quote" testID="skeleton-quote" /> : null}
        {live.status === "error" ? (
          <View testID="quote-error" className="gap-3 rounded-2xl bg-surface p-5 dark:bg-surface-dark">
            <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{"Couldn't open the quote"}</Text>
            <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{live.message}</Text>
            <Pressable onPress={live.retry} accessibilityRole="button" className="min-h-[44px] justify-center self-start">
              <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {quote && !open ? <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{NOT_WAITING}</Text> : null}
        {quote ? <QuoteCard quote={quote} /> : null}
        {quote?.notes ? (
          <View className="gap-2">
            <SectionHeader title="Notes" />
            <Text className="px-1 text-[16px] leading-6 text-on-surface dark:text-on-surface-dark">{htmlToText(quote.notes)}</Text>
          </View>
        ) : null}
      </ScrollView>

      {open ? (
        <View className="flex-row gap-3 border-t border-border bg-surface px-4 pt-3 dark:border-border-dark dark:bg-surface-dark" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            testID="quote-decline"
            onPress={() => router.push(`/quote/${id}/decline`)}
            accessibilityRole="button"
            className={`min-h-[52px] flex-1 items-center justify-center rounded-full ${
              android ? "border border-border-strong dark:border-border-strong-dark" : "bg-surface-sunken dark:bg-surface-sunken-dark"
            }`}
          >
            <Text className={`text-[17px] font-semibold ${android ? "text-primary dark:text-primary-dark" : "text-on-surface dark:text-on-surface-dark"}`}>Decline</Text>
          </Pressable>
          <Pressable
            testID="quote-accept"
            onPress={() => router.push(`/quote/${id}/accept`)}
            accessibilityRole="button"
            className="min-h-[52px] flex-[1.4] flex-row items-center justify-center gap-2 rounded-full bg-primary dark:bg-primary-dark"
          >
            {android ? null : <Signature size={20} color={colors.onPrimary} />}
            <Text className="text-[17px] font-semibold text-on-primary dark:text-on-primary-dark">Accept quote</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
