import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, SectionList, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import ArrowUpLeft from "lucide-react-native/icons/arrow-up-left";
import Briefcase from "lucide-react-native/icons/briefcase";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock from "lucide-react-native/icons/clock";
import CircleMinus from "lucide-react-native/icons/circle-minus";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import SearchIcon from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { EmptyState, StatusChip, useNativeColors } from "@spine/ui-native";
import { useAssignedJobs, type FieldJob } from "../../lib/data/jobs";
import { EXPENSE_STATUS, MY_EXPENSES_KEY, MY_EXPENSES_PATH, type MyExpense } from "../../lib/data/expenses";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { useModules } from "../../lib/data/modules";
import { useBusinessFormat } from "../../lib/data/business";
import { calendarDay, daysUntil, dayMonth, weekday, money, oneLine } from "../../lib/format";
import { highlightParts, searchCache, type ExpenseHit } from "../../lib/search/search";
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from "../../lib/search/recent-searches";
import { ListRowsSkeleton } from "../../components/skeletons";
import { useOutboxItems } from "../../lib/outbox/pending";
import type { OutboxItem } from "../../lib/outbox/types";

/** Expenses still on the phone, as search rows (US-MOB-23: "Waiting"). */
export function waitingExpenses(items: readonly OutboxItem[]): MyExpense[] {
  return items.flatMap((item) =>
    item.kind === "expense" && item.status !== "sent"
      ? [
          {
            id: item.id,
            number: null,
            categoryName: item.payload.categoryName,
            jobId: item.payload.jobId,
            date: item.payload.date,
            amount: item.payload.amount,
            currency: item.payload.currency,
            description: item.payload.description,
            status: "submitted" as const,
            reviewComment: null,
            createdAt: new Date(item.createdAt).toISOString(),
          },
        ]
      : [],
  );
}

export const SEARCH_PLACEHOLDER = "Search jobs and expenses";
export const SEARCH_HINT = "Find a job by name, customer or address, or one of your expenses by category or description.";
export const NO_RESULTS_HINT = "Search covers the jobs you're on and your own expenses. Try a customer name, a street or an expense category.";
const DEBOUNCE_MS = 200;

/** Text with the matching part highlighted (US-MOB-23). */
export function Highlighted({ text, query, className, numberOfLines }: { text: string; query: string; className: string; numberOfLines?: number }) {
  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {highlightParts(text, query).map((part, index) =>
        part.match ? (
          <Text key={index} testID="search-highlight" className="bg-due-soon-bg dark:bg-due-soon-bg-dark">
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

function expenseDay(date: string, locale: string): string {
  const day = calendarDay(date);
  const days = daysUntil(day);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  return days > -7 && days < 0 ? `${weekday(day, locale)} ${dayMonth(day, locale)}` : dayMonth(day, locale);
}

type Row = { kind: "job"; job: FieldJob } | { kind: "expense"; hit: ExpenseHit };

/**
 * US-MOB-23 · `MobSearch`, `MobSearchResults`, `MobSearchEmpty` (and
 * Android) — one place to find a job or one of my expenses. Searches the
 * phone's cache (works offline), as you type; recent searches stay on this
 * phone. iOS uses the tab bar's search field (`role="search"`); Android a
 * search bar at the top of its fourth tab.
 */
export function SearchScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const modules = useModules();
  const jobs = useAssignedJobs(modules.jobsField);
  const expenses = useCachedQuery<MyExpense[]>(MY_EXPENSES_KEY, MY_EXPENSES_PATH);
  const queued = useOutboxItems();
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const android = Platform.OS === "android";

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  useFocusEffect(
    useCallback(() => {
      void getRecentSearches().then(setRecent);
    }, []),
  );

  const results = useMemo(
    () => searchCache({ query, jobs: jobs.data ?? [], expenses: expenses.data ?? [], waitingExpenses: waitingExpenses(queued), jobsOn: modules.jobsField }),
    [query, jobs.data, expenses.data, modules.jobsField, queued],
  );
  const searching = query.trim().length > 0;
  const sections = [
    ...(results.jobs.length ? [{ key: "jobs", title: "Jobs", count: results.jobs.length, data: results.jobs.map((job): Row => ({ kind: "job", job })) }] : []),
    ...(results.expenses.length ? [{ key: "expenses", title: "Your expenses", count: results.expenses.length, data: results.expenses.map((hit): Row => ({ kind: "expense", hit })) }] : []),
  ];

  const remember = useCallback(async () => setRecent(await addRecentSearch(query)), [query]);
  const open = (row: Row) => {
    void remember();
    // An expense still on the phone has nothing on the server to open yet: Sync shows it.
    router.push(row.kind === "job" ? `/jobs/${row.job.id}` : row.hit.waiting ? "/sync" : `/expenses/${row.hit.expense.id}`);
  };
  const searchFor = (value: string) => {
    setTyped(value);
    setQuery(value);
  };

  // On iOS the scroll view is the screen's root, so the large title and search bar inset it.
  const recentList = (
    <ScrollView
      testID="search-recent"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-3 px-4 pb-32 pt-3"
    >
      {recent.length ? (
        <>
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-[20px] font-semibold text-on-surface dark:text-on-surface-dark">
              Recent searches
            </Text>
            <Pressable
              testID="search-recent-action"
              hitSlop={10}
              accessibilityRole="button"
              className="min-h-[44px] justify-center"
              onPress={async () => {
                if (android) {
                  await clearRecentSearches();
                  setRecent([]);
                } else setEditing((value) => !value);
              }}
            >
              <Text className="text-[16px] text-primary dark:text-primary-dark">{android ? "Clear" : editing ? "Done" : "Edit"}</Text>
            </Pressable>
          </View>
          <View className={android ? "" : "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark"}>
            {recent.map((entry, index) => (
              <Pressable
                key={entry}
                testID={`search-recent-${index}`}
                onPress={() => (editing ? undefined : searchFor(entry))}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${entry}`}
                className={`min-h-[52px] flex-row items-center gap-3 px-4 ${index ? "border-t border-border dark:border-border-dark" : ""}`}
              >
                {editing ? (
                  <Pressable
                    onPress={async () => setRecent(await removeRecentSearch(entry))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry}`}
                    hitSlop={10}
                  >
                    <CircleMinus size={20} color={colors.overdue} />
                  </Pressable>
                ) : (
                  <Clock size={20} color={colors.onSurfaceMuted} />
                )}
                <Text className="flex-1 text-[17px] text-on-surface dark:text-on-surface-dark">{entry}</Text>
                {editing ? null : <ArrowUpLeft size={18} color={colors.onSurfaceMuted} />}
              </Pressable>
            ))}
          </View>
          <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{SEARCH_HINT}</Text>
        </>
      ) : (
        <EmptyState className="pt-12" icon={<SearchIcon size={28} color={colors.onSurfaceMuted} />} title={SEARCH_PLACEHOLDER} description={SEARCH_HINT} />
      )}
    </ScrollView>
  );

  const resultsList = (
    <SectionList
      testID="search-results"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="px-4 pb-32 pt-2"
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(row) => (row.kind === "job" ? `job-${row.job.id}` : `expense-${row.hit.expense.id}`)}
      renderSectionHeader={({ section }) => (
        <Text testID={`search-group-${section.key}`} accessibilityRole="header" className={android ? "pb-2 pt-4 text-[15px] font-medium text-primary dark:text-primary-dark" : "pb-2 pt-4 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark"}>
          {android ? `${section.title} · ${section.count}` : `${section.title} · ${section.count}`.toUpperCase()}
        </Text>
      )}
      renderItem={({ item: row, index, section }) => {
        const first = index === 0;
        const last = index === section.data.length - 1;
        const shape = android ? "" : `bg-surface dark:bg-surface-dark ${first ? "rounded-t-2xl" : "border-t border-border dark:border-border-dark"} ${last ? "rounded-b-2xl" : ""}`;
        if (row.kind === "job") {
          const job = row.job;
          const detail = [job.contactName, job.siteAddress ? oneLine(job.siteAddress) : null].filter(Boolean).join(" · ");
          return (
            <Pressable testID={`search-job-${job.id}`} onPress={() => open(row)} accessibilityRole="button" accessibilityLabel={`${job.name}, ${detail}`} className={`flex-row items-center gap-3 px-3 py-3 ${shape}`}>
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-info-bg dark:bg-info-bg-dark">
                <Briefcase size={20} color={colors.primary} />
              </View>
              <View className="flex-1 gap-0.5">
                <Highlighted text={job.name} query={query} numberOfLines={1} className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark" />
                {detail ? <Highlighted text={detail} query={query} numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark" /> : null}
              </View>
              {android ? null : <ChevronRight size={18} color={colors.onSurfaceMuted} />}
            </Pressable>
          );
        }
        const { expense, jobName, waiting } = row.hit;
        const status = waiting ? { label: "Waiting", status: "draft" as const } : EXPENSE_STATUS[expense.status];
        const line = [expenseDay(expense.date, format.locale), jobName ?? expense.description].filter(Boolean).join(" · ");
        return (
          <Pressable testID={`search-expense-${expense.id}`} onPress={() => open(row)} accessibilityRole="button" accessibilityLabel={`${expense.categoryName ?? "Expense"}, ${money(expense.amount, { currency: expense.currency, locale: format.locale })}, ${status.label}`} className={`flex-row items-center gap-3 px-3 py-3 ${shape}`}>
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-draft-bg dark:bg-draft-bg-dark">
              <ReceiptText size={20} color={colors.onSurfaceMuted} />
            </View>
            <View className="flex-1 gap-0.5">
              <Highlighted text={expense.categoryName ?? "Expense"} query={query} numberOfLines={1} className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark" />
              {line ? <Highlighted text={line} query={query} numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark" /> : null}
            </View>
            <View className="items-end gap-1">
              <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{money(expense.amount, { currency: expense.currency, locale: format.locale })}</Text>
              <StatusChip status={status.status}>{status.label}</StatusChip>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        // Nothing saved on the phone yet and the first fetch is out: rows, not "No results".
        (modules.jobsField && jobs.loading) || expenses.loading ? (
          <View className="pt-4">
            <ListRowsSkeleton label="Loading your jobs and expenses" testID="skeleton-search" rows={3} leading trailing="amount" />
          </View>
        ) : (
        <EmptyState
          testID="search-empty"
          className="pt-12"
          icon={<SearchIcon size={28} color={colors.onSurfaceMuted} />}
          title={`No results for “${query.trim()}”`}
          description={NO_RESULTS_HINT}
        />
        )
      }
    />
  );

  const body = searching ? resultsList : recentList;

  if (!android) {
    return (
      <>
        <Stack.Screen
          options={{
            headerSearchBarOptions: {
              placeholder: SEARCH_PLACEHOLDER,
              autoCapitalize: "none",
              hideWhenScrolling: false,
              onChangeText: (event) => setTyped(event.nativeEvent.text),
              onSearchButtonPress: (event) => {
                if (event.nativeEvent.text.trim()) void addRecentSearch(event.nativeEvent.text).then(setRecent);
              },
              onCancelButtonPress: () => searchFor(""),
            },
          }}
        />
        {body}
      </>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-4 pb-2 pt-3">
        <View className="h-14 flex-row items-center gap-3 rounded-full bg-surface-sunken px-4 dark:bg-surface-sunken-dark">
          <SearchIcon size={20} color={colors.onSurfaceMuted} />
          <TextInput
            testID="search-input"
            value={typed}
            onChangeText={setTyped}
            placeholder={SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.onSurfaceMuted}
            accessibilityLabel={SEARCH_PLACEHOLDER}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void remember()}
            className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark"
          />
          {typed.length ? (
            <Pressable onPress={() => searchFor("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={20} color={colors.onSurfaceMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {body}
    </View>
  );
}
