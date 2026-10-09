import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import { FullWidthButton, OutlinedTextField, useNativeColors } from "@spine/ui-native";
import { acceptQuote, forgetPresented, presentation, signatureFile, type PresentedQuote } from "../../lib/data/quotes";
import { useSession, useSignedInSession } from "../../lib/session/session-provider";
import { connectivity } from "../../lib/connectivity";
import { ApiError, OfflineError } from "../../lib/api/errors";
import { money } from "../../lib/format";
import { useBusinessFormat } from "../../lib/data/business";
import { SignaturePad } from "../../components/signature-pad";
import { hasSignature, type Stroke } from "../../lib/signature/png";
import { NEEDS_CONNECTION_MESSAGE, NEEDS_CONNECTION_TITLE } from "./needs-connection";

export const NAME_HINT = "Type the customer's name to continue.";
export const SIGN_HINT = "Sign in the box to continue.";

/** "By signing, I accept this quote for $601.16 on behalf of Harborview Construction Co. Spine records …" */
export function acceptStatement(total: string, customer: string, business: string, witness: string): string {
  // "Harborview Construction Co." already ends the sentence.
  return `By signing, I accept this quote for ${total} on behalf of ${customer}${customer.endsWith(".") ? "" : "."} Spine records your signature, the time and the ${business} staff member present (${witness}).`;
}

/** Header for the quote's pushed screens: iOS a round back button and a centred title; Android the top app bar. */
export function QuoteHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const colors = useNativeColors();
  if (Platform.OS === "android") {
    return (
      <View className="flex-row items-center gap-4 px-2 py-2">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="h-12 w-12 items-center justify-center">
          <ArrowLeft size={24} color={colors.onSurface} />
        </Pressable>
        <Text accessibilityRole="header" className="text-[22px] text-on-surface dark:text-on-surface-dark">
          {title}
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center px-4 py-2">
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} className="h-11 w-11 items-center justify-center rounded-full bg-surface dark:bg-surface-dark">
        <ChevronLeft size={22} color={colors.onSurface} />
      </Pressable>
      <Text accessibilityRole="header" className="flex-1 pr-11 text-center text-[17px] font-semibold text-on-surface dark:text-on-surface-dark">
        {title}
      </Text>
    </View>
  );
}

/**
 * US-MOB-17 · `MobQuoteAccept` / `MobQuoteAcceptAndroid` — the customer
 * types their name and signs; "Accept and sign" stays off (with a hint)
 * until both are there. It needs a connection (US-MOB-18): the signature
 * is uploaded and the acceptance recorded straight away (US-QUO-19).
 */
export function AcceptScreen({ quote, onBack, onAccepted }: { quote: PresentedQuote; onBack: () => void; onAccepted: (answer: PresentedQuote) => void }) {
  const android = Platform.OS === "android";
  const insets = useSafeAreaInsets();
  const colors = useNativeColors();
  const { request } = useSession();
  const { member } = useSignedInSession();
  const { locale } = useBusinessFormat();
  const [name, setName] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const total = money(quote.totalAmount, { currency: quote.currency, locale });
  const customer = quote.contactName ?? "the customer";
  const signed = hasSignature(strokes);
  const ready = name.trim().length > 0 && signed && !saving;
  const hint = !name.trim() ? NAME_HINT : !signed ? SIGN_HINT : null;

  const accept = useCallback(async () => {
    if (!ready) return;
    if (!connectivity.get()) {
      Alert.alert(NEEDS_CONNECTION_TITLE, NEEDS_CONNECTION_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const answer = await acceptQuote(request, quote.id, { signerName: name, signature: signatureFile(strokes, size) });
      presentation.answered(answer);
      await forgetPresented(presentation.get(quote.id)?.jobId, quote.id);
      onAccepted(answer);
    } catch (error) {
      setSaving(false);
      if (error instanceof OfflineError) Alert.alert(NEEDS_CONNECTION_TITLE, NEEDS_CONNECTION_MESSAGE);
      else if (error instanceof ApiError && (error.status === 410 || error.status === 404)) Alert.alert("This quote was already answered", "Go back to the job to see what's changed.");
      else Alert.alert("Couldn't record the acceptance", "Nothing was saved. Check your connection and try again.");
    }
  }, [ready, request, quote.id, name, strokes, size, onAccepted]);

  return (
    <View testID="quote-accept-screen" className="flex-1 bg-background dark:bg-background-dark" style={{ paddingTop: insets.top }}>
      <QuoteHeader title={`Accept ${quote.number ?? "quote"}`} onBack={onBack} />
      <ScrollView scrollEnabled={!drawing} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" contentContainerClassName="gap-5 px-4 pb-6 pt-2">
        <View className={`flex-row items-center justify-between gap-3 rounded-2xl p-4 ${android ? "bg-surface-sunken dark:bg-surface-sunken-dark" : "bg-surface dark:bg-surface-dark"}`}>
          <View className="flex-1 gap-0.5">
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Customer</Text>
            <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{customer}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Total</Text>
            <Text testID="accept-total" className="text-[22px] font-bold text-on-surface dark:text-on-surface-dark">
              {total}
            </Text>
          </View>
        </View>

        {android ? (
          <OutlinedTextField testID="accept-name" label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" returnKeyType="done" />
        ) : (
          <View className="gap-2">
            <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">Your name</Text>
            <TextInput
              testID="accept-name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              accessibilityLabel="Your name"
              placeholderTextColor={colors.onSurfaceMuted}
              className="min-h-[52px] rounded-xl bg-surface px-4 text-[17px] text-on-surface dark:bg-surface-dark dark:text-on-surface-dark"
            />
          </View>
        )}

        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className={android ? "text-[15px] font-medium text-primary dark:text-primary-dark" : "text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark"}>Sign below</Text>
            <Pressable testID="signature-clear" onPress={() => setStrokes([])} disabled={!strokes.length} accessibilityRole="button" accessibilityLabel="Clear the signature" className="min-h-[44px] justify-center">
              <Text className={`text-[16px] font-medium ${strokes.length ? "text-primary dark:text-primary-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark"}`}>Clear</Text>
            </Pressable>
          </View>
          <SignaturePad strokes={strokes} onChange={setStrokes} onSize={setSize} onDrawing={setDrawing} label={`Signature of ${name.trim() || "the customer"}`} />
        </View>

        <Text testID="accept-statement" className="text-[15px] leading-[22px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {acceptStatement(total, customer, quote.business.name, member.name)}
        </Text>
      </ScrollView>
      <View className="gap-2 px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        {hint ? (
          <Text testID="accept-hint" className="text-center text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
            {hint}
          </Text>
        ) : null}
        <FullWidthButton testID="accept-sign" label={saving ? "Recording…" : "Accept and sign"} onPress={() => void accept()} disabled={!ready} />
      </View>
    </View>
  );
}
