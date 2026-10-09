import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import ImagePlus from "lucide-react-native/icons/image-plus";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { toDecimalString } from "@spine/shared/money";
import { DateTimePicker, FloatingLabelField, FORM_ROW_HEIGHT, FormRow, FormSection, OutlinedTextField, SegmentedControl, SelectListField, useNativeColors } from "@spine/ui-native";
import { outbox } from "../../lib/outbox/outbox";
import { syncEngine } from "../../lib/outbox/sync-engine";
import { pickPhoto } from "../../lib/outbox/pick-photo";
import { formatBytes } from "../../lib/outbox/local-files";
import { newIdempotencyKey } from "../../lib/api/idempotency";
import { useCameraResult } from "../../lib/camera/handoff";
import { useAssignedJobs } from "../../lib/data/jobs";
import { useModules } from "../../lib/data/modules";
import { useBusinessFormat } from "../../lib/data/business";
import { DIRECT_LABOUR_CODE, useExpenseCategories, useLabourTrades } from "../../lib/data/categories";
import { money } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { EXPENSE_NOTE, fromPayload, LABOUR_NOTE, parseAmount, rowAmount, toPayload, tradesTotal, validateDraft, type DraftErrors, type ExpenseDraft, type TradeRow } from "./expense-form";
import { useAndroidBack } from "../../lib/use-android-back";

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
  const [request] = useState(newIdempotencyKey);
  const update = (patch: Partial<ExpenseDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  // The edited item's own receipt stays until the change is saved; photos taken here go when replaced.
  const original = editing?.kind === "expense" ? editing.payload.receipt : null;
  const setReceipt = (receipt: ExpenseDraft["receipt"]) =>
    setDraft((prev) => {
      if (prev.receipt && prev.receipt.uri !== receipt?.uri && prev.receipt.uri !== original?.uri) outbox.discardPhoto(prev.receipt);
      return { ...prev, receipt };
    });
  useCameraResult(request, (photos) => photos[0] && setReceipt(photos[0]));

  const openReceiptCamera = () => router.push(`/camera?mode=receipt&request=${request}`);
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
  const setMode = (mode: ExpenseDraft["mode"]) => update({ mode, ...(mode === "labour" && !draft.categoryId && labourCategory ? { categoryId: labourCategory.id } : {}) });

  const liveErrors = useMemo(() => (Object.keys(errors).length ? validateDraft(draft, currency) : {}), [draft, currency, errors]);
  const shown = Object.keys(errors).length ? liveErrors : {};

  const cancel = () => {
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

  const total = tradesTotal(draft.trades, currency);
  const labour = draft.mode === "labour";
  // Android: which trade's fields are open (the first, or the one just added).
  const [activeTrade, setActiveTrade] = useState<string | null>(null);
  const categoryField = {
    floatingLabel: "Category",
    placeholder: "Choose a category",
    sheetTitle: "Category",
    value: draft.categoryId,
    error: Boolean(shown.category),
    options: categories.map((c) => ({ label: c.name, value: c.id })),
    onValueChange: (categoryId: string) => update({ categoryId }),
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

      <SegmentedControl testID="expense-mode" values={MODES.map((m) => m.label)} value={MODES.find((m) => m.value === draft.mode)!.label} onValueChange={(label) => setMode(MODES.find((m) => m.label === label)!.value)} />

      {labour ? null : (
        <View className={android ? "" : "items-center gap-1"}>
          {android ? (
            <OutlinedTextField
              testID="expense-amount"
              label={`Amount (${currency})`}
              prefix={currencySymbol(currency, format.locale)}
              value={draft.amount}
              onChangeText={(amount) => update({ amount })}
              keyboardType="decimal-pad"
              error={Boolean(shown.amount)}
              helperText={shown.amount ?? undefined}
            />
          ) : (
            <>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Amount ({currency})</Text>
              <View className="flex-row items-center">
                <Text className="text-[40px] font-bold text-on-surface dark:text-on-surface-dark">{currencySymbol(currency, format.locale)}</Text>
                <TextInput
                  testID="expense-amount"
                  value={draft.amount}
                  onChangeText={(amount) => update({ amount })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.onSurfaceMuted}
                  accessibilityLabel={`Amount (${currency})`}
                  className="min-w-[120px] text-[40px] font-bold text-on-surface dark:text-on-surface-dark"
                />
              </View>
              {shown.amount ? <Text className="text-[14px] text-overdue dark:text-overdue-dark">{shown.amount}</Text> : null}
            </>
          )}
        </View>
      )}

      {android ? (
        // `MobExpenseNewAndroid`: Material outlined fields, no grouped card.
        <View className="gap-4">
          <SelectListField testID="expense-category" variant="outlined" {...categoryField} helperText={shown.category ?? undefined} />
          {jobField ? <SelectListField testID="expense-job" variant="outlined" {...jobField} helperText={shown.job ?? undefined} /> : null}
          <DateTimePicker testID="expense-date" variant="outlined" label="Date" mode="date" value={draft.date} maximumDate={new Date()} onChange={(date) => update({ date })} />
        </View>
      ) : (
        <FormSection>
          <FormRow error={shown.category}>
            <SelectListField testID="expense-category" variant="row" {...categoryField} />
          </FormRow>
          {jobField ? (
            <FormRow error={shown.job}>
              <SelectListField testID="expense-job" variant="row" {...jobField} />
            </FormRow>
          ) : null}
          <FormRow label="Date" last>
            <DateTimePicker testID="expense-date" mode="date" value={draft.date} maximumDate={new Date()} onChange={(date) => update({ date })} />
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
            <OutlinedTextField testID="expense-description" label="Description" value={draft.description} onChangeText={(description) => update({ description })} />
          ) : (
            <FormSection>
              <FormRow last>
                <FloatingLabelField testID="expense-description" label="Description" value={draft.description} onChangeText={(description) => update({ description })} />
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
                  {draft.receipt.name} · {formatBytes(draft.receipt.size)}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    testID="receipt-retake"
                    onPress={openReceiptCamera}
                    accessibilityRole="button"
                    className={`min-h-[44px] flex-row items-center gap-2 rounded-full px-4 ${android ? "border border-border-strong dark:border-border-strong-dark" : "bg-info-bg dark:bg-info-bg-dark"}`}
                  >
                    <Camera size={18} color={colors.primary} />
                    <Text className="text-[15px] font-semibold text-primary dark:text-primary-dark">Retake receipt</Text>
                  </Pressable>
                  <Pressable onPress={() => setReceipt(null)} accessibilityRole="button" accessibilityLabel="Remove receipt" hitSlop={8} className="min-h-[44px] justify-center px-2">
                    <Text className="text-[15px] font-medium text-overdue dark:text-overdue-dark">Remove</Text>
                  </Pressable>
                </View>
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
