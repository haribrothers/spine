import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Link, Stack, useFocusEffect } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import ClockIcon from "lucide-react-native/icons/clock";
import SearchIcon from "lucide-react-native/icons/search";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { COMPONENT_CATALOG } from "../../../src/lib/component-catalog";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "../../../src/lib/recent-searches-storage";

/**
 * Search tab — filters `COMPONENT_CATALOG` by title/description.
 *
 * The search FIELD itself is `headerSearchBarOptions` (`react-native-screens`'
 * real `UISearchController`-integrated bar on iOS, with a genuine Android
 * fallback), not a hand-rolled `TextField` — per
 * https://developer.apple.com/design/human-interface-guidelines/search-fields,
 * a real native search field is the correct component here, not an
 * approximation. `hideWhenScrolling: false` keeps it always visible (this
 * screen has no large title to collapse away from under it); `autoCapitalize:
 * "none"` matches the previous `TextField`'s behavior (component names are
 * lowercase).
 *
 * When the query is empty, this shows RECENT SEARCHES (not the full
 * unfiltered catalog, which is what an earlier version showed) — also per
 * the HIG doc's own guidance that a search field's results area should
 * offer recent searches/suggestions before the user types anything.
 * Recent searches persist across app restarts via
 * `recent-searches-storage.ts` (`expo-secure-store`, same mechanism
 * `theme-storage.ts` already uses) — a query is recorded once the user
 * actually opens a result, not on every keystroke.
 *
 * Selecting a result links to `/search/[slug]` (this tab's OWN copy of the
 * detail route), not `/components/[slug]` — see that file's own doc
 * comment for the real, user-reported back-navigation bug this fixes.
 */
export default function SearchScreen() {
  const colors = useNativeColors();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getRecentSearches().then(setRecent);
    }, []),
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return COMPONENT_CATALOG.filter((entry) => entry.title.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q));
  }, [query]);

  const recordSearch = useCallback(async (value: string) => {
    const next = await addRecentSearch(value);
    setRecent(next);
  }, []);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecent([]);
  }, []);

  const isSearching = query.trim().length > 0;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search components",
            autoCapitalize: "none",
            hideWhenScrolling: false,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            onSearchButtonPress: (e) => {
              if (e.nativeEvent.text.trim()) recordSearch(e.nativeEvent.text);
            },
            onCancelButtonPress: () => setQuery(""),
          },
        }}
      />
      {isSearching ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(entry) => entry.slug}
          contentContainerClassName="gap-2 px-4 pb-4 pt-4"
          ListEmptyComponent={
            <EmptyState
              icon={<SearchIcon size={24} color={colors.onSurfaceMuted} />}
              title="No components found"
              description={`Nothing matches "${query}".`}
            />
          }
          renderItem={({ item: entry }) => (
            <Link href={`/search/${entry.slug}`} asChild>
              <Pressable
                onPress={() => recordSearch(query)}
                className="flex-row items-center justify-between rounded-lg border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
              >
                <View className="flex-1 gap-0.5 pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{entry.title}</Text>
                    {entry.native ? (
                      <View className="rounded-full bg-info-bg px-1.5 py-0.5 dark:bg-info-bg-dark">
                        <Text className="text-[10px] font-medium text-info dark:text-info-dark">Native</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{entry.description}</Text>
                </View>
                <ChevronRight size={18} color={colors.onSurfaceMuted} />
              </Pressable>
            </Link>
          )}
        />
      ) : recent.length > 0 ? (
        <View className="flex-1 px-4 pt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
              Recent Searches
            </Text>
            <Pressable onPress={handleClearRecent} hitSlop={8}>
              <Text className="text-[13px] font-medium text-primary dark:text-primary-dark">Clear</Text>
            </Pressable>
          </View>
          {recent.map((entryQuery) => (
            <Pressable
              key={entryQuery}
              onPress={() => setQuery(entryQuery)}
              className="flex-row items-center gap-3 border-b border-border py-3 dark:border-border-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
            >
              <ClockIcon size={16} color={colors.onSurfaceMuted} />
              <Text className="flex-1 text-[15px] text-on-surface dark:text-on-surface-dark">{entryQuery}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          className="flex-1 justify-center"
          icon={<SearchIcon size={24} color={colors.onSurfaceMuted} />}
          title="Search components"
          description="Find any component by name or description."
        />
      )}
    </View>
  );
}
