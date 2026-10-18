import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Plus from "lucide-react-native/icons/plus";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { MY_EXPENSES_KEY, MY_EXPENSES_PATH, type MyExpense } from "../../lib/data/expenses";
import { useBusinessFormat } from "../../lib/data/business";
import { useAssignedJobs } from "../../lib/data/jobs";
import { useOutboxItems } from "../../lib/outbox/pending";
import { calendarDay, daysUntil, dayMonth, money, weekday } from "../../lib/format";
import { SectionHeader } from "../../components/section-header";
import { ListRowsSkeleton } from "../../components/skeletons";
import { ExpenseStatusChip, expenseStatusLabel, expenseStatusTextClass } from "../../components/expense-status";
import { categoryIcon } from "../../components/category-icon";
import { WaitingChip } from "../../components/waiting-chip";
import { Fab } from "../../components/fab";
import { useAiStatus } from "../../lib/data/ai";

export const EXPENSES_EMPTY_TITLE = "No expenses yet";
export const EXPENSES_EMPTY_MESSAGE = "Log fuel, materials or meals here with a photo of the receipt. Your office approves them before you're paid back.";

function dayLabel(date: string, locale: string): string {
  const d = calendarDay(date);
  const days = daysUntil(d);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  return `${weekday(d, locale)} ${dayMonth(d, locale)}`;
}

function Row({ first, onPress, testID, accessibilityLabel, children }: { first: boolean; onPress: () => void; testID?: string; accessibilityLabel: string; children: React.ReactNode }) {
  const android = Platform.OS === "android";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row items-start gap-3 px-4 py-3 active:opacity-80 ${first || android ? "" : "border-t border-border dark:border-border-dark"}`}
    >
      {children}
    </Pressable>
  );
}

function Icon({ category, waiting }: { category: string | null; waiting?: boolean }) {
  const colors = useNativeColors();
  const Glyph = categoryIcon(category);
  return (
    <View className={`h-11 w-11 items-center justify-center rounded-xl ${waiting ? "bg-draft-bg dark:bg-draft-bg-dark" : "bg-info-bg dark:bg-info-bg-dark"}`}>
      <Glyph size={20} color={waiting ? colors.onSurfaceMuted : colors.primary} />
    </View>
  );
}

/**
 * US-MOB-12 · `MobExpensesList` (and Android) — my expenses: WAITING TO SYNC
 * (still on the phone) and SUBMITTED BY YOU with category, date, job,
 * amount and status; a rejection shows the reviewer's reason in red. "+"
 * in the toolbar on iOS, a floating "Log expense" on Android, opens New
 * expense. Only ever my own (the API answers nothing else to Field).
 */
export function ExpensesScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const android = Platform.OS === "android";
  // US-AI-10: kept for New expense, so "Read receipt" can show disabled when the phone is offline later.
  useAiStatus();
  const list = useCachedQuery<(MyExpense & { reviewerName?: string | null })[]>(MY_EXPENSES_KEY, MY_EXPENSES_PATH, { refreshOnForeground: true, refreshOnSent: (item) => item.kind === "expense" });
  const jobs = useAssignedJobs(false).data ?? [];
  const jobName = (id: string | null) => (id ? (jobs.find((j) => j.id === id)?.name ?? null) : null);
  const waiting = useOutboxItems().filter((item) => item.kind === "expense" && item.status !== "sent");
  const submitted = list.data ?? [];
  const logExpense = () => router.push("/expense-new");

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        testID="expenses-list"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 px-4 pb-32 pt-3"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.onSurfaceMuted} />}
      >
        {waiting.length ? (
          <View className="gap-2">
            <SectionHeader title="Waiting to sync" />
            <View className={android ? "-mx-4" : "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark"}>
              {waiting.map((item, index) => {
                if (item.kind !== "expense") return null;
                const p = item.payload;
                const failed = item.status === "failed";
                const amount = money(p.amount, { currency: p.currency, locale: format.locale });
                return (
                  <Row key={item.id} first={index === 0} testID={`expense-waiting-${item.id}`} onPress={() => router.push(failed ? `/sync/fix/${item.id}` : "/sync")} accessibilityLabel={`${p.categoryName}, ${amount}, ${failed ? "didn't send" : "waiting to sync"}`}>
                    <Icon category={p.categoryName} waiting />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{p.categoryName}</Text>
                      <Text numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
                        {[dayLabel(p.date, format.locale), p.jobName, android && !failed ? "waiting to sync" : null].filter(Boolean).join(" · ")}
                      </Text>
                      {failed ? <Text className="text-[14px] text-overdue dark:text-overdue-dark">{item.error}</Text> : null}
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{amount}</Text>
                      {android ? null : <WaitingChip label={failed ? "Fix" : "Waiting"} />}
                    </View>
                  </Row>
                );
              })}
            </View>
          </View>
        ) : null}

        {submitted.length ? (
          <View className="gap-2">
            <SectionHeader title="Submitted by you" testID="expenses-submitted" />
            <View className={android ? "-mx-4" : "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark"}>
              {submitted.map((expense, index) => {
                const amount = money(expense.amount, { currency: expense.currency, locale: format.locale });
                const job = jobName(expense.jobId);
                const reason = expense.status === "rejected" && expense.reviewComment ? `“${expense.reviewComment}”${expense.reviewerName ? ` — ${expense.reviewerName}` : ""}` : null;
                return (
                  <Row key={expense.id} first={index === 0} testID={`expense-row-${expense.id}`} onPress={() => router.push(`/expenses/${expense.id}`)} accessibilityLabel={[expense.categoryName, amount, expenseStatusLabel(expense.status), reason].filter(Boolean).join(", ")}>
                    <Icon category={expense.categoryName} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{expense.categoryName ?? "Expense"}</Text>
                      {android ? (
                        <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
                          {expense.status === "rejected" ? "" : `${dayLabel(expense.date, format.locale)} · `}
                          <Text className={expenseStatusTextClass(expense.status)}>{expenseStatusLabel(expense.status)}</Text>
                          {reason ? ` · ${reason}` : ""}
                        </Text>
                      ) : (
                        <>
                          <Text numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
                            {[dayLabel(expense.date, format.locale), job].filter(Boolean).join(" · ")}
                          </Text>
                          {reason ? <Text testID={`expense-reason-${expense.id}`} className="text-[14px] text-overdue dark:text-overdue-dark">{reason}</Text> : null}
                        </>
                      )}
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{amount}</Text>
                      {android ? null : <ExpenseStatusChip status={expense.status} />}
                    </View>
                  </Row>
                );
              })}
            </View>
          </View>
        ) : list.loading ? (
          <ListRowsSkeleton label="Loading your expenses" testID="skeleton-expenses" rows={4} leading trailing="amount" />
        ) : !waiting.length && list.data ? (
          <EmptyState
            testID="expenses-empty"
            className="pt-16"
            icon={
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-draft-bg dark:bg-draft-bg-dark">
                <ReceiptText size={30} color={colors.onSurfaceMuted} />
              </View>
            }
            title={EXPENSES_EMPTY_TITLE}
            description={EXPENSES_EMPTY_MESSAGE}
          />
        ) : null}
      </ScrollView>
      {android ? (
        <Fab testID="expenses-log" label="Log expense" icon={Plus} onPress={logExpense} />
      ) : null}
    </View>
  );
}
