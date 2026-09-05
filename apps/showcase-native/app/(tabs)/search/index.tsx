import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
 * **The search FIELD itself is genuinely platform-divergent, not shared —
 * a real, confirmed gap, not a stylistic choice.** On iOS it's
 * `headerSearchBarOptions` (`react-native-screens`' real
 * `UISearchController`-integrated bar), per
 * https://developer.apple.com/design/human-interface-guidelines/search-fields
 * — a real native search field is the correct component there.
 * `hideWhenScrolling: false` keeps it always visible (this screen has no
 * large title to collapse away from under it); `autoCapitalize: "none"`
 * matches the Android field's own behavior (component names are
 * lowercase).
 *
 * On Android, `headerSearchBarOptions` is backed by
 * `androidx.appcompat.widget.SearchView` (confirmed by reading
 * `react-native-screens`' own `CustomSearchView.kt`) — the OLD, pre-Material-3
 * search widget, NOT the rounded pill-shaped `SearchBar` modern Android apps
 * (Google Photos, etc.) actually use. There is no way to get that Material 3
 * look "for free" from `react-native-screens` on Android, so it's hand-built
 * below instead (a plain `TextField`-style `View`+`TextInput`, full-width,
 * `rounded-full`, search icon inline) — a real, user-reported requirement
 * matching a Google Photos reference screenshot, not a design preference.
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
 *
 * Result-list spacing uses `ItemSeparatorComponent`, NOT a `gap-2` on
 * `contentContainerClassName` — a real, user-reported bug: unlike a plain
 * `ScrollView` (every other list in this app), `FlatList`'s content
 * container is rendered by `VirtualizedList` internally, and NativeWind's
 * `gap-*` utility didn't apply there, so results rendered flush with no
 * space between rows. `ItemSeparatorComponent` is RN's own supported
 * mechanism for inter-item spacing and isn't subject to this gap.
 *
 * **iOS results list gets an explicit `insets.top` padding on its own —
 * a real, user-reported bug.** `headerSearchBarOptions`'s activated/typing
 * state is a genuine native `UISearchController` interaction (confirmed:
 * Apple's own apps, e.g. Podcasts/Music, hide the nav title the same way
 * while a search bar is focused — not a bug on its own), but this screen
 * has no large title and lives inside a `NativeTabs` host with very little
 * header chrome to begin with, so once search is active the results list's
 * `contentInsetAdjustmentBehavior="automatic"` has nothing stable to
 * compute insets from and the first row rendered flush under the status
 * bar with zero top space. Fixed with an explicit `paddingTop:
 * insets.top` (iOS only — Android's own hand-built pill already reserves
 * its own top spacing via the `View` above the list, and never loses its
 * header/title the way iOS's native search-activation does).
 */
export default function SearchScreen() {
  const colors = useNativeColors();
  const insets = useSafeAreaInsets();
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
      {Platform.OS === "ios" ? (
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
      ) : (
        <View className="px-4 pb-2 pt-3">
          <View className="h-14 flex-row items-center gap-3 rounded-full bg-surface-sunken px-4 dark:bg-surface-sunken-dark">
            <SearchIcon size={20} color={colors.onSurfaceMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search components"
              placeholderTextColor={colors.onSurfaceMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (query.trim()) recordSearch(query);
              }}
              className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Text className="text-[13px] font-medium text-on-surface-muted dark:text-on-surface-muted-dark">Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      {isSearching ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(entry) => entry.slug}
          contentContainerClassName="px-4 pb-4 pt-4"
          contentContainerStyle={Platform.OS === "ios" ? { paddingTop: insets.top + 16 } : undefined}
          ItemSeparatorComponent={() => <View className="h-2" />}
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
