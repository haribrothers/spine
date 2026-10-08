import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { EmptyState, Skeleton, StatusChip } from "@spine/ui-native";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useBusinessFormat } from "../../lib/data/business";
import { useAssignedJobs } from "../../lib/data/jobs";
import { EXPENSE_STATUS, expenseKey, type MyExpense } from "../../lib/data/expenses";
import { calendarDay, money, weekdayDayMonth } from "../../lib/format";

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View className={`flex-row justify-between gap-4 px-4 py-3 ${first ? "" : "border-t border-border dark:border-border-dark"}`}>
      <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
      <Text className="flex-1 text-right text-[15px] text-on-surface dark:text-on-surface-dark">{value}</Text>
    </View>
  );
}

/**
 * US-MOB-22, US-MOB-23 — one of my expenses, where a search result or an
 * approval or rejection lands: amount, category, date, job, status and the
 * reviewer's reason when it was rejected. Only my own (the API answers 404
 * for anyone else's).
 */
export function ExpenseScreen({ id }: { id: string }) {
  const format = useBusinessFormat();
  const expense = useCachedQuery<MyExpense>(expenseKey(id), `/expenses/${id}`);
  const jobs = useAssignedJobs(false);
  const e = expense.data;
  const jobName = e?.jobId ? (jobs.data?.find((job) => job.id === e.jobId)?.name ?? null) : null;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-4 p-4 pb-16">
      <Stack.Screen options={{ title: e?.categoryName ?? "Expense" }} />
      {e ? (
        <>
          <View className="items-center gap-2 py-4" testID="expense">
            <Text className="text-[34px] font-bold text-on-surface dark:text-on-surface-dark">{money(e.amount, { currency: e.currency, locale: format.locale })}</Text>
            <StatusChip status={EXPENSE_STATUS[e.status].status}>{EXPENSE_STATUS[e.status].label}</StatusChip>
          </View>
          {e.status === "rejected" && e.reviewComment ? (
            <View accessibilityRole="alert" className="rounded-lg bg-overdue-bg px-4 py-3 dark:bg-overdue-bg-dark">
              <Text className="text-[15px] text-overdue dark:text-overdue-dark">{e.reviewComment}</Text>
            </View>
          ) : null}
          <View className="overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark">
            <Row first label="Category" value={e.categoryName ?? "—"} />
            <Row label="Date" value={weekdayDayMonth(calendarDay(e.date), format.locale)} />
            {jobName ? <Row label="Job" value={jobName} /> : null}
            {e.description ? <Row label="Description" value={e.description} /> : null}
            {e.number ? <Row label="Number" value={e.number} /> : null}
          </View>
        </>
      ) : expense.status === "loading" ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <EmptyState title="This expense isn't available" description="Only your own expenses show on your phone." />
      )}
    </ScrollView>
  );
}
