import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import ImagePlus from "lucide-react-native/icons/image-plus";
import Plus from "lucide-react-native/icons/plus";
import Sparkles from "lucide-react-native/icons/sparkles";
import X from "lucide-react-native/icons/x";
import { toDecimalString } from "@spine/shared/money";
import { AI_TIMEOUT_MS, aiPausedMessage, type ReceiptSuggestion } from "@spine/shared/schemas";
import { DateTimePicker, FloatingLabelField, FORM_ROW_HEIGHT, FormRow, FormSection, OutlinedTextField, SegmentedControl, SelectListField, useNativeColors } from "@spine/ui-native";
import { outbox } from "../../lib/outbox/outbox";
import { syncEngine } from "../../lib/outbox/sync-engine";
import { uploadReceipt } from "../../lib/outbox/send";
import { MAX_UPLOAD_BYTES } from "../../lib/outbox/types";
import { pickPhoto } from "../../lib/outbox/pick-photo";
import { formatBytes } from "../../lib/outbox/local-files";
import { newIdempotencyKey } from "../../lib/api/idempotency";
import { useCameraResult } from "../../lib/camera/handoff";
import { useAssignedJobs } from "../../lib/data/jobs";
import { useModules } from "../../lib/data/modules";
import { receiptReadOffered, useAiStatus } from "../../lib/data/ai";
import { useOnline } from "../../lib/connectivity";
import { useSession } from "../../lib/session/session-provider";
import { useBusinessFormat } from "../../lib/data/business";
import { DIRECT_LABOUR_CODE, useExpenseCategories, useLabourTrades } from "../../lib/data/categories";
import { money } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { PillButton } from "../../components/pill-button";
import { AiSuggestedTag } from "../../components/ai-suggested-tag";
import {
  AI_FILLED_NOTE,
  AI_KEPT_NOTE,
  enteredFields,
  EXPENSE_NOTE,
  fromPayload,
  LABOUR_NOTE,
  parseAmount,
  planReceiptFill,
  READ_RECEIPT_OFFLINE,
  readFailure,
  RECEIPT_TOO_BIG,
  rowAmount,
  toPayload,
  tradesTotal,
  validateDraft,
  type AiExpenseField,
  type DraftErrors,
  type ExpenseDraft,
  type TradeRow,
} from "./expense-form";
import { useAndroidBack } from "../../lib/use-android-back";
import { OfflineError } from "../../lib/api/errors";

const MODES = [
  { value: "amount", label: "Amount" },
  { value: "labour", label: "Headcount × day rate" },
] as const;
const PAID_BY = [
  { value: "employee", label: "Me — pay me back" },
  { value: "company", label: "Company" },
] as const;
const NO_JOB = "none";

let rowCounter = 0;
const newRow = (): TradeRow => ({ key: `row-${++rowCounter}`, trade: "", headcount: "", dayRate: "" });

/** "$" for USD, "₹" for INR — from the business's own money format (Hermes has no formatToParts). */
export function currencySymbol(currency: string, locale: string): string {
  return money("0", { currency, locale }).replace(/[\d.,\s ]/g, "") || currency;
}

/**
 * A group's label: iOS's section header ("PAID BY"); Android's muted field
 * label above the control, as `MobExpenseNewAndroid` draws it (US-MOB-20).
 */
function FieldGroupLabel({ title }: { title: string }) {
  if (Platform.OS !== "android") return <SectionHeader title={title} />;
  return (
    <Text accessibilityRole="header" className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
      {title}
    </Text>
  );
}

/** A trade field's box: the floating-label field fills a fixed-height parent, as in a form row. */
function FieldBox({ children, grow = false }: { children: React.ReactNode; grow?: boolean }) {
  return (
    <View className={`rounded-lg border border-border-strong px-3 dark:border-border-strong-dark ${grow ? "flex-1" : ""}`} style={{ height: FORM_ROW_HEIGHT }}>
      {children}
    </View>
  );
}

function TradeEditor({
  row,
  currency,
  locale,
  suggestions,
  onChange,
  onRemove,
  index,
  active = true,
  onActivate,
}: {
  row: TradeRow;
  currency: string;
  locale: string;
  suggestions: { trade: string; lastDayRateAmount: string }[];
  onChange: (row: TradeRow) => void;
  onRemove?: () => void;
  index: number;
  /** Android: only the trade being edited shows its fields; the others are one line each (`MobExpenseLabourAndroid`). */
  active?: boolean;
  onActivate?: () => void;
}) {
  const colors = useNativeColors();
  const amount = rowAmount(row, currency);
  const typed = row.trade.trim().toLowerCase();
  const matches = typed ? suggestions.filter((s) => s.trade.toLowerCase().startsWith(typed) && s.trade.toLowerCase() !== typed).slice(0, 3) : [];
  const perDay = `${row.headcount || "0"} × ${money(parseAmount(row.dayRate, currency)?.toString() ?? "0", { currency, locale })}`;
  const total = money((amount ?? 0n).toString(), { currency, locale });
  const suggestionChips = matches.length ? (
    <View className="flex-row flex-wrap gap-2">
      {matches.map((s) => (
        <Pressable
          key={s.trade}
          testID={`trade-suggestion-${s.trade}`}
          onPress={() => onChange({ ...row, trade: s.trade, dayRate: row.dayRate || toDecimalString({ amount: BigInt(s.lastDayRateAmount), currency }) })}
          accessibilityRole="button"
          accessibilityLabel={`${s.trade}, last day rate ${money(s.lastDayRateAmount, { currency, locale })}`}
          className="min-h-[36px] justify-center rounded-full bg-info-bg px-3 dark:bg-info-bg-dark"
        >
          <Text className="text-[14px] text-primary dark:text-primary-dark">
            {s.trade} · {money(s.lastDayRateAmount, { currency, locale })}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  if (Platform.OS === "android") {
    if (!active) {
      return (
        <Pressable testID={`trade-row-${index}`} onPress={onActivate} accessibilityRole="button" accessibilityLabel={`${row.trade || "Trade"}, ${perDay}, ${total}. Edit`} className="min-h-[56px] flex-row items-center gap-3 px-1 py-2">
          <View className="flex-1">
            <Text className="text-[16px] text-on-surface dark:text-on-surface-dark">{row.trade || "New trade"}</Text>
            <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{perDay}</Text>
          </View>
          <Text testID={`trade-total-${index}`} className="text-[16px] text-on-surface dark:text-on-surface-dark">
            {total}
          </Text>
        </Pressable>
      );
    }
    return (
      <View testID={`trade-row-${index}`} className="gap-3 rounded-2xl border border-outline-variant p-3 dark:border-outline-variant-dark">
        <View className="flex-row items-center gap-1">
          <View className="flex-1">
            <OutlinedTextField testID={`trade-name-${index}`} label="Trade" value={row.trade} onChangeText={(trade) => onChange({ ...row, trade })} autoCapitalize="words" />
          </View>
          {onRemove ? (
            <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${row.trade || "this trade"}`} hitSlop={10} className="h-11 w-11 items-center justify-center">
              <X size={20} color={colors.onSurfaceMuted} />
            </Pressable>
          ) : null}
        </View>
        {suggestionChips}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <OutlinedTextField testID={`trade-workers-${index}`} label="Workers" value={row.headcount} onChangeText={(headcount) => onChange({ ...row, headcount: headcount.replace(/\D/g, "") })} keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <OutlinedTextField testID={`trade-rate-${index}`} label="Day rate" prefix={currencySymbol(currency, locale)} value={row.dayRate} onChangeText={(dayRate) => onChange({ ...row, dayRate })} keyboardType="decimal-pad" />
          </View>
        </View>
        <View className="flex-row justify-between px-1">
          <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{perDay}</Text>
          <Text testID={`trade-total-${index}`} className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">
            {total}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View testID={`trade-row-${index}`} className={`gap-2 px-4 py-3 ${index ? "border-t border-border dark:border-border-dark" : ""}`}>
      <View className="flex-row items-center gap-2">
        <FieldBox grow>
          <FloatingLabelField forceTextField testID={`trade-name-${index}`} label="Trade" value={row.trade} onChangeText={(trade) => onChange({ ...row, trade })} autoCapitalize="words" />
        </FieldBox>
        {onRemove ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${row.trade || "this trade"}`} hitSlop={10} className="h-11 w-11 items-center justify-center">
            <X size={20} color={colors.onSurfaceMuted} />
          </Pressable>
        ) : null}
      </View>
      {suggestionChips}
      <View className="flex-row gap-3">
        <FieldBox grow>
          <FloatingLabelField forceTextField testID={`trade-workers-${index}`} label="Workers" value={row.headcount} onChangeText={(headcount) => onChange({ ...row, headcount: headcount.replace(/\D/g, "") })} keyboardType="numeric" />
        </FieldBox>
        <FieldBox grow>
          <FloatingLabelField forceTextField testID={`trade-rate-${index}`} label="Day rate" value={row.dayRate} onChangeText={(dayRate) => onChange({ ...row, dayRate })} keyboardType="decimal" />
        </FieldBox>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{perDay}</Text>
        <Text testID={`trade-total-${index}`} className="text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">
          {total}
        </Text>
      </View>
    </View>
  );
}

/**
 * US-MOB-13 · `MobExpenseNew`, `MobExpenseLabour`, `MobReceiptCapture` (and
 * Android) — a new expense on the phone: the amount in the business
 * currency, or "Headcount × day rate" (D-199: trades, workers and day
 * rates, a job, Direct Labour preselected); category, job, date, paid by,
 * description and a receipt photo. "Submit" puts it in the outbox. Opened
 * with `scan` it starts with the receipt camera; with `edit` it fixes an
 * expense the server refused (US-MOB-09) and sends it again.
 *
 * US-AI-10 (`MobExpenseNewAi`, D-251): with AI on, "Read receipt" uploads
 * the photo and asks AI to read it while the person waits — online only,
 * never from the queue — and fills the amount, date, category and
 * description they haven't entered, each "Suggested by AI" until changed.
 */
export function NewExpenseScreen({ scan = false, editId }: { scan?: boolean; editId?: string }) {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const currency = format.currency;
  const android = Platform.OS === "android";
  const modules = useModules();
  const jobs = useAssignedJobs(modules.jobsField).data ?? [];
  const categories = (useExpenseCategories().data ?? []).filter((c) => !c.archivedAt);
  const trades = useLabourTrades().data ?? [];
  const editing = editId ? outbox.get(editId) : undefined;
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    editing?.kind === "expense"
      ? fromPayload(editing.payload, (minor) => toDecimalString({ amount: BigInt(minor), currency: editing.payload.currency }))
      : { mode: "amount", amount: "", categoryId: null, jobId: null, date: new Date(), paidBy: "employee", description: "", receipt: null, trades: [newRow()] },
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [cameraRequest] = useState(newIdempotencyKey);
  const update = (patch: Partial<ExpenseDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  // US-AI-10 — reading the receipt with AI.
  const { request } = useSession();
  const online = useOnline();
  const aiStatus = useAiStatus();
  const [aiFields, setAiFields] = useState<Set<AiExpenseField>>(new Set());
  const entered = useRef(enteredFields(draft, Boolean(editing)));
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<{ message: string; canRetry: boolean; offline?: boolean } | null>(null);
  const [readUri, setReadUri] = useState<string | null>(null);
  const [currencyNote, setCurrencyNote] = useState<string | null>(null);
  const [replaceOffer, setReplaceOffer] = useState<{ patch: Partial<ExpenseDraft>; fields: AiExpenseField[] } | null>(null);
  const readRun = useRef<AbortController | null>(null);
  // One key per photo: a retried upload of the same photo returns its first id, a new photo gets its own (D-009).
  const uploadKeys = useRef(new Map<string, string>());
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => () => readRun.current?.abort(), []);
  // A read that failed for want of a connection says nothing more once the phone is back: the button works again.
  useEffect(() => {
    if (online) setReadError((error) => (error?.offline ? null : error));
  }, [online]);
  const stopReading = () => {
    readRun.current?.abort();
    readRun.current = null;
    setReading(false);
  };
  /** A field the person sets is theirs: AI won't change it, and its tag goes. */
  const mine = (field: AiExpenseField) => {
    entered.current.add(field);
    setAiFields((prev) => (prev.has(field) ? new Set([...prev].filter((f) => f !== field)) : prev));
  };

  // The edited item's own receipt stays until the change is saved; photos taken here go when replaced.
  const original = editing?.kind === "expense" ? editing.payload.receipt : null;
  const setReceipt = (receipt: ExpenseDraft["receipt"]) => {
    // A different photo: a read still out is dropped, and it's unread.
    if (receipt?.uri !== latest.current.receipt?.uri) {
      stopReading();
      setReadUri(null);
      setReadError(null);
    }
    setDraft((prev) => {
      if (prev.receipt && prev.receipt.uri !== receipt?.uri && prev.receipt.uri !== original?.uri) outbox.discardPhoto(prev.receipt);
      return { ...prev, receipt };
    });
  };
  useCameraResult(cameraRequest, (photos) => photos[0] && setReceipt(photos[0]));

  const openReceiptCamera = () => router.push(`/camera?mode=receipt&request=${cameraRequest}`);
  const scanned = useRef(false);
  useEffect(() => {
    if (scan && !scanned.current) {
      scanned.current = true;
      openReceiptCamera();
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  const labourCategory = categories.find((c) => c.accountCode === DIRECT_LABOUR_CODE);
  const setMode = (mode: ExpenseDraft["mode"]) => {
    // Labour has no "Read receipt" (US-AI-10): a read still out stops, and fills nothing.
    if (mode === "labour") {
      stopReading();
      setReadError(null);
    }
    update({ mode, ...(mode === "labour" && !draft.categoryId && labourCategory ? { categoryId: labourCategory.id } : {}) });
  };

  const liveErrors = useMemo(() => (Object.keys(errors).length ? validateDraft(draft, currency) : {}), [draft, currency, errors]);
  const shown = Object.keys(errors).length ? liveErrors : {};

  const cancel = () => {
    stopReading();
    if (draft.receipt && draft.receipt.uri !== original?.uri) outbox.discardPhoto(draft.receipt);
    router.back();
  };
  useAndroidBack(cancel);
  const submit = async () => {
    const found = validateDraft(draft, currency);
    setErrors(found);
    if (Object.keys(found).length || saving) return;
    setSaving(true);
    const category = categories.find((c) => c.id === draft.categoryId);
    const payload = toPayload(draft, { category: category?.name ?? "", job: jobs.find((j) => j.id === draft.jobId)?.name ?? null }, currency);
    if (editing) {
      if (original && original.uri !== draft.receipt?.uri) outbox.discardPhoto(original);
      await outbox.update(editing.id, { payload } as never);
      router.back();
      await syncEngine.resend(editing.id);
    } else {
      await outbox.addExpense(payload);
      router.back();
    }
  };

  /** US-AI-10 — puts what AI read into the fields still empty, tags them, and offers the rest. */
  const applySuggestion = (suggestion: ReceiptSuggestion, uri: string) => {
    const fill = planReceiptFill(latest.current, entered.current, suggestion, { currency, categoryIds: new Set(categories.map((c) => c.id)), today: new Date() });
    if (fill.filled.length) setDraft((prev) => ({ ...prev, ...fill.patch, aiAssisted: true }));
    setAiFields((prev) => new Set([...prev, ...fill.filled]));
    setReadUri(uri);
    setCurrencyNote(fill.currencyNote);
    setReplaceOffer(fill.keptFields.length ? { patch: fill.kept, fields: fill.keptFields } : null);
    // VoiceOver and TalkBack hear what happened, not just sighted people.
    const said = [fill.filled.length ? AI_FILLED_NOTE : null, fill.currencyNote, fill.keptFields.length ? AI_KEPT_NOTE : null].filter(Boolean).join(" ");
    if (said) AccessibilityInfo.announceForAccessibility(said);
  };
  const applyRef = useRef(applySuggestion);
  applyRef.current = applySuggestion;

  /** "Replace my entries (<n>)": AI's values for the fields the person had filled. */
  const replaceMine = () => {
    if (!replaceOffer) return;
    setDraft((prev) => ({ ...prev, ...replaceOffer.patch, aiAssisted: true }));
    for (const field of replaceOffer.fields) entered.current.delete(field);
    setAiFields((prev) => new Set([...prev, ...replaceOffer.fields]));
    setReplaceOffer(null);
  };

  /**
   * "Read receipt": upload the photo now (so the queued expense uses this
   * file, not a second upload), then ask AI to read it. Cancel, a retake
   * or leaving drops the answer; the form stays usable throughout.
   */
  const readReceipt = async () => {
    const photo = latest.current.receipt;
    if (!photo) return;
    if (photo.size > MAX_UPLOAD_BYTES) return setReadError({ message: RECEIPT_TOO_BIG, canRetry: false });
    readRun.current?.abort();
    const run = new AbortController();
    readRun.current = run;
    setReading(true);
    setReadError(null);
    try {
      let key = uploadKeys.current.get(photo.uri);
      if (!key) {
        key = newIdempotencyKey();
        uploadKeys.current.set(photo.uri, key);
      }
      const uploaded = await uploadReceipt(request, photo, key, run.signal);
      if (run.signal.aborted || latest.current.mode !== "amount") return;
      if (uploaded.fileId !== photo.fileId) setDraft((prev) => (prev.receipt?.uri === photo.uri ? { ...prev, receipt: { ...prev.receipt, fileId: uploaded.fileId } } : prev));
      // The server gives the provider 30 seconds (US-AI-07); wait a little longer than that.
      const suggestion = await request<ReceiptSuggestion>("POST", "/ai/read-document", { body: { fileId: uploaded.fileId, target: "expense" }, timeoutMs: AI_TIMEOUT_MS + 15_000, signal: run.signal });
      if (run.signal.aborted || latest.current.mode !== "amount" || latest.current.receipt?.uri !== photo.uri) return;
      applyRef.current(suggestion, photo.uri);
    } catch (error) {
      if (run.signal.aborted) return;
      const failure = { ...readFailure(error), offline: error instanceof OfflineError };
      setReadError(failure);
      AccessibilityInfo.announceForAccessibility(failure.message);
    } finally {
      if (readRun.current === run) {
        readRun.current = null;
        setReading(false);
      }
    }
  };

  const total = tradesTotal(draft.trades, currency);
  const labour = draft.mode === "labour";
  // Hidden unless AI may read receipts here; shown disabled, with why, offline or while the budget is used up (21-ai.md).
  const readOffered = receiptReadOffered(aiStatus) && !labour;
  const paused = aiStatus?.pausedUntil ?? null;
  const read = Boolean(draft.receipt && readUri === draft.receipt.uri);
  const pickDate = (date: Date) => {
    if (date.getTime() !== draft.date.getTime()) mine("date");
    update({ date });
  };
  const changeDescription = (description: string) => {
    if (description !== draft.description) mine("description");
    update({ description });
  };
  // Android: which trade's fields are open (the first, or the one just added).
  const [activeTrade, setActiveTrade] = useState<string | null>(null);
  const categoryField = {
    floatingLabel: "Category",
    placeholder: "Choose a category",
    sheetTitle: "Category",
    value: draft.categoryId,
    error: Boolean(shown.category),
    options: categories.map((c) => ({ label: c.name, value: c.id })),
    onValueChange: (categoryId: string) => {
      if (categoryId !== draft.categoryId) mine("category");
      update({ categoryId });
    },
  };
  const jobField = modules.jobsField
    ? {
        floatingLabel: "Job",
        placeholder: labour ? "Choose a job" : "No job",
        sheetTitle: "Job",
        value: draft.jobId ?? (labour ? null : NO_JOB),
        error: Boolean(shown.job),
        options: [...(labour ? [] : [{ label: "No job", value: NO_JOB }]), ...jobs.map((j) => ({ label: j.name, value: j.id }))],
        onValueChange: (id: string) => update({ jobId: id === NO_JOB ? null : id }),
      }
    : null;

  return (
    <ScrollView testID="new-expense" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-5 px-4 pb-16 pt-4">
      <Stack.Screen
        options={
          android
            ? {
                title: editing ? "Fix expense" : "New expense",
                headerLeft: () => (
                  <Pressable onPress={cancel} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} className="mr-4 h-11 w-11 justify-center">
                    <X size={24} color={colors.onSurface} />
                  </Pressable>
                ),
                headerRight: () => (
                  <Pressable testID="expense-submit" onPress={() => void submit()} disabled={saving} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full bg-primary px-5 dark:bg-primary-dark">
                    <Text className="text-[15px] font-semibold text-on-primary dark:text-on-primary-dark">{editing ? "Send" : "Submit"}</Text>
                  </Pressable>
                ),
              }
            : {
                title: editing ? "Fix expense" : "New expense",
                unstable_headerLeftItems: () => [{ type: "button" as const, label: "Cancel", onPress: cancel }],
                unstable_headerRightItems: () => [{ type: "button" as const, label: editing ? "Send" : "Submit", variant: "prominent" as const, tintColor: colors.primary, onPress: () => void submit() }],
              }
        }
      />

      {!labour && (aiFields.size > 0 || currencyNote || replaceOffer) ? (
        <View testID="expense-ai-filled" accessibilityLiveRegion="polite" className="flex-row items-start gap-3 rounded-xl bg-info-bg px-4 py-3 dark:bg-info-bg-dark">
          <Sparkles size={20} color={colors.primary} />
          <View className="flex-1 gap-1">
            {aiFields.size > 0 ? <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">{AI_FILLED_NOTE}</Text> : null}
            {currencyNote ? <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">{currencyNote}</Text> : null}
            {replaceOffer ? (
              <View className="flex-row flex-wrap items-center gap-x-2">
                <Text className="text-[14px] text-on-surface dark:text-on-surface-dark">{AI_KEPT_NOTE}</Text>
                <Pressable testID="ai-replace-mine" onPress={replaceMine} accessibilityRole="button" hitSlop={8} className="min-h-[44px] justify-center">
                  <Text className="text-[14px] font-semibold text-primary dark:text-primary-dark">Replace my entries ({replaceOffer.fields.length})</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <SegmentedControl testID="expense-mode" values={MODES.map((m) => m.label)} value={MODES.find((m) => m.value === draft.mode)!.label} onValueChange={(label) => setMode(MODES.find((m) => m.label === label)!.value)} />

      {labour ? null : (
        <View className={android ? "" : "items-center gap-1"}>
          {android ? (
            <View className="gap-1.5">
              <OutlinedTextField
                testID="expense-amount"
                label={`Amount (${currency})`}
                prefix={currencySymbol(currency, format.locale)}
                value={draft.amount}
                onChangeText={(amount) => {
                  mine("amount");
                  update({ amount });
                }}
                keyboardType="decimal-pad"
                error={Boolean(shown.amount)}
                helperText={shown.amount ?? undefined}
              />
              {aiFields.has("amount") ? <AiSuggestedTag className="self-start" /> : null}
            </View>
          ) : (
            <>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Amount ({currency})</Text>
              <View className="flex-row items-center">
                <Text className="text-[40px] font-bold text-on-surface dark:text-on-surface-dark">{currencySymbol(currency, format.locale)}</Text>
                <TextInput
                  testID="expense-amount"
                  value={draft.amount}
                  onChangeText={(amount) => {
                    mine("amount");
                    update({ amount });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.onSurfaceMuted}
                  accessibilityLabel={`Amount (${currency})`}
                  className="min-w-[120px] text-[40px] font-bold text-on-surface dark:text-on-surface-dark"
                />
              </View>
              {aiFields.has("amount") ? <AiSuggestedTag /> : null}
              {shown.amount ? <Text className="text-[14px] text-overdue dark:text-overdue-dark">{shown.amount}</Text> : null}
            </>
          )}
        </View>
      )}

      {android ? (
        // `MobExpenseNewAndroid`: Material outlined fields, no grouped card.
        <View className="gap-4">
          <View className="gap-1.5">
            <SelectListField testID="expense-category" variant="outlined" {...categoryField} helperText={shown.category ?? undefined} />
            {aiFields.has("category") ? <AiSuggestedTag className="self-start" /> : null}
          </View>
          {jobField ? <SelectListField testID="expense-job" variant="outlined" {...jobField} helperText={shown.job ?? undefined} /> : null}
          <View className="gap-1.5">
            <DateTimePicker testID="expense-date" variant="outlined" label="Date" mode="date" value={draft.date} maximumDate={new Date()} onChange={pickDate} />
            {aiFields.has("date") ? <AiSuggestedTag className="self-start" /> : null}
          </View>
        </View>
      ) : (
        <FormSection>
          <FormRow error={shown.category}>
            {/* The tag sits on the caption's line, clear of the chevron; taps go through to the row. */}
            <View className="h-full justify-center">
              <SelectListField testID="expense-category" variant="row" {...categoryField} />
              {aiFields.has("category") ? <AiSuggestedTag className="absolute right-6 top-2" /> : null}
            </View>
          </FormRow>
          {jobField ? (
            <FormRow error={shown.job}>
              <SelectListField testID="expense-job" variant="row" {...jobField} />
            </FormRow>
          ) : null}
          {/* `MobExpenseNewAi`: the tag sits under the "Date" caption, so the picker keeps its room on a narrow phone. */}
          <FormRow last>
            <View className="flex-row items-center justify-between gap-3">
              <View className="shrink gap-0.5">
                <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">Date</Text>
                {aiFields.has("date") ? <AiSuggestedTag className="self-start" /> : null}
              </View>
              <View className="flex-1 items-end">
                <DateTimePicker testID="expense-date" mode="date" value={draft.date} maximumDate={new Date()} onChange={pickDate} />
              </View>
            </View>
          </FormRow>
        </FormSection>
      )}

      {labour ? (
        <View className="gap-2">
          <SectionHeader title="Trades" />
          {/* Android (US-MOB-20): no card — the trade being edited is an outlined card, the rest one line each. */}
          <View className={android ? "gap-1" : "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark"}>
            {draft.trades.map((row, index) => (
              <TradeEditor
                key={row.key}
                index={index}
                row={row}
                currency={currency}
                locale={format.locale}
                suggestions={trades}
                active={(activeTrade ?? draft.trades[0]?.key) === row.key}
                onActivate={() => setActiveTrade(row.key)}
                onChange={(next) => update({ trades: draft.trades.map((r) => (r.key === row.key ? next : r)) })}
                onRemove={draft.trades.length > 1 ? () => update({ trades: draft.trades.filter((r) => r.key !== row.key) }) : undefined}
              />
            ))}
            <Pressable
              testID="trade-add"
              onPress={() => {
                const row = newRow();
                update({ trades: [...draft.trades, row] });
                setActiveTrade(row.key);
              }}
              accessibilityRole="button"
              className={`min-h-[52px] flex-row items-center gap-2 px-4 ${android ? "self-start" : "border-t border-border dark:border-border-dark"}`}
            >
              <Plus size={20} color={colors.primary} />
              <Text className="text-[16px] font-medium text-primary dark:text-primary-dark">Add trade</Text>
            </Pressable>
          </View>
          {shown.trades ? <Text className="px-1 text-[14px] text-overdue dark:text-overdue-dark">{shown.trades}</Text> : null}
          <View className={`flex-row items-center justify-between px-4 py-4 ${android ? "" : "rounded-2xl bg-surface dark:bg-surface-dark"}`}>
            <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">Total for the day</Text>
            <Text testID="trades-total" className="text-[22px] font-bold text-on-surface dark:text-on-surface-dark">{money(total.toString(), format)}</Text>
          </View>
          <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{LABOUR_NOTE}</Text>
        </View>
      ) : (
        <>
          <View className="gap-2">
            <FieldGroupLabel title="Paid by" />
            <SegmentedControl testID="expense-paid-by" values={PAID_BY.map((p) => p.label)} value={PAID_BY.find((p) => p.value === draft.paidBy)!.label} onValueChange={(label) => update({ paidBy: PAID_BY.find((p) => p.label === label)!.value })} />
          </View>
          {android ? (
            <View className="gap-1.5">
              <OutlinedTextField testID="expense-description" label="Description" value={draft.description} onChangeText={changeDescription} />
              {aiFields.has("description") ? <AiSuggestedTag className="self-start" /> : null}
            </View>
          ) : (
            <FormSection>
              <FormRow last>
                <View className="h-full justify-center">
                  <FloatingLabelField testID="expense-description" label="Description" value={draft.description} onChangeText={changeDescription} />
                  {aiFields.has("description") ? <AiSuggestedTag className="absolute right-0 top-2" /> : null}
                </View>
              </FormRow>
            </FormSection>
          )}
        </>
      )}

      <View className="gap-2">
        <FieldGroupLabel title="Receipt" />
        <View className={`flex-row items-center gap-4 ${android ? "" : "rounded-2xl bg-surface p-3 dark:bg-surface-dark"}`}>
          {draft.receipt ? (
            <>
              <Image source={{ uri: draft.receipt.uri }} accessibilityLabel="Receipt" className="h-[84px] w-[72px] rounded-lg" />
              <View className="flex-1 gap-2">
                <Text testID="receipt-info" className={`text-[14px] ${shown.receipt || draft.receipt.size > 10 * 1024 * 1024 ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark"}`}>
                  {draft.receipt.name} · {read ? "read by AI" : formatBytes(draft.receipt.size)}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {readOffered ? (
                    <>
                      <PillButton
                        testID="receipt-read"
                        label={reading ? "Reading…" : read ? "Read again" : "Read receipt"}
                        icon={Sparkles}
                        working={reading}
                        disabled={!online || Boolean(paused)}
                        accessibilityHint={!online ? READ_RECEIPT_OFFLINE : paused ? aiPausedMessage(paused) : undefined}
                        onPress={() => void readReceipt()}
                      />
                      {reading ? (
                        <Pressable testID="receipt-read-cancel" onPress={stopReading} accessibilityRole="button" accessibilityLabel="Cancel reading the receipt" hitSlop={8} className="min-h-[44px] justify-center px-2">
                          <Text className="text-[15px] font-medium text-primary dark:text-primary-dark">Cancel</Text>
                        </Pressable>
                      ) : null}
                      <PillButton testID="receipt-retake" label="Retake" accessibilityLabel="Retake receipt" icon={Camera} neutral onPress={openReceiptCamera} />
                    </>
                  ) : (
                    <Pressable
                      testID="receipt-retake"
                      onPress={openReceiptCamera}
                      accessibilityRole="button"
                      className={`min-h-[44px] flex-row items-center gap-2 rounded-full px-4 ${android ? "border border-border-strong dark:border-border-strong-dark" : "bg-info-bg dark:bg-info-bg-dark"}`}
                    >
                      <Camera size={18} color={colors.primary} />
                      <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Retake receipt</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setReceipt(null)} accessibilityRole="button" accessibilityLabel="Remove receipt" hitSlop={8} className="min-h-[44px] justify-center px-2">
                    <Text className="text-[15px] font-medium text-overdue dark:text-overdue-dark">Remove</Text>
                  </Pressable>
                </View>
                {readOffered && !reading && (!online || paused) ? (
                  <Text testID="receipt-read-note" className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
                    {!online ? READ_RECEIPT_OFFLINE : aiPausedMessage(paused!)}
                  </Text>
                ) : null}
                {/* Offline, the note above already says why; the same words in red twice would only repeat it. */}
                {readOffered && readError && !(readError.offline && !online) ? (
                  <View testID="receipt-read-error" accessibilityRole="alert" accessibilityLiveRegion="polite" className="flex-row flex-wrap items-center gap-x-2">
                    <Text className="text-[13px] text-overdue dark:text-overdue-dark">{readError.message}</Text>
                    {readError.canRetry && online ? (
                      <Pressable onPress={() => void readReceipt()} accessibilityRole="button" accessibilityLabel="Try reading the receipt again" hitSlop={8} className="min-h-[44px] justify-center">
                        <Text className="text-[13px] font-semibold text-primary dark:text-primary-dark">Try again</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <View className="flex-1 flex-row flex-wrap gap-2">
              <Pressable testID="receipt-take" onPress={openReceiptCamera} accessibilityRole="button" className="min-h-[44px] flex-row items-center gap-2 rounded-full bg-info-bg px-4 dark:bg-info-bg-dark">
                <Camera size={18} color={colors.primary} />
                <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Take a photo</Text>
              </Pressable>
              <Pressable
                testID="receipt-choose"
                onPress={async () => {
                  const picked = await pickPhoto("library");
                  if (picked) setReceipt(picked);
                }}
                accessibilityRole="button"
                className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-border-strong px-4 dark:border-border-strong-dark"
              >
                <ImagePlus size={18} color={colors.primary} />
                <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Choose a photo</Text>
              </Pressable>
            </View>
          )}
        </View>
        {shown.receipt ? <Text className="px-1 text-[14px] text-overdue dark:text-overdue-dark">{shown.receipt}</Text> : null}
      </View>

      <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{EXPENSE_NOTE}</Text>
    </ScrollView>
  );
}
