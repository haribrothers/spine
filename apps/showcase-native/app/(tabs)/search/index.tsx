import { useCallback, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Link, Stack, useFocusEffect } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import SearchIcon from "lucide-react-native/icons/search";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { COMPONENT_CATALOG, type ComponentCatalogEntry } from "../../../src/lib/component-catalog";
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
 * `hideWhenScrolling: false` keeps it always visible; `autoCapitalize:
 * "none"` matches the Android field's own behavior (component names are
 * lowercase). `hideNavigationBar: false` keeps the "Search" title visible
 * throughout the active/typing search state — see below for the full
 * history of that fix.
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
 * **This screen renders exactly ONE `FlatList` at all times — never three
 * separately-mounted trees for results/recent/empty — specifically so
 * `headerLargeTitleEnabled` (see `_layout.tsx`) always has the same single,
 * stable scroll view to track for its collapse animation.** `(home)/
 * index.tsx`'s own doc comment documents the real, reproduced bug this
 * guards against: `react-native-screens`' large-title collapse tracking
 * auto-detects a screen's own scroll view via a heuristic that only walks
 * the screen's first-level subview, and swapping between different
 * mounted trees (or wrapping the scroll view in an extra `View`) defeats
 * that detection, leaving the large title floating on top of scrolled
 * content instead of collapsing into the small pinned title. This screen
 * used to render three conditionally-mounted trees (a results `FlatList`,
 * a plain non-scrolling recent-searches `View`, and a non-scrolling
 * `EmptyState`) and deliberately skipped large title altogether to avoid
 * ever hitting this bug — seeing large title on every sibling tab was a
 * real, explicit user request that this restructuring now satisfies
 * instead of continuing to avoid. `results`/`recent search rows`/nothing
 * are now just different `data` arrays (a small tagged-row union, `Row`)
 * on the SAME `FlatList` instance, with the "Recent searches (N)" header
 * row + "Edit" action rendered via `ListHeaderComponent` and the
 * zero-state via `ListEmptyComponent` — both real `FlatList` props that
 * render regardless of which `data` is currently set, so the identity of
 * the scroll view itself never changes as the user types or clears a
 * query.
 *
 * **Recent-searches row styling matches a reference screenshot of a real
 * iOS Recent Searches list** (bold, plain white/on-surface titles, no
 * clock icon, no row separators, generous vertical rhythm) — replacing an
 * earlier version's bordered rows with a small gray clock icon per row,
 * which read as a generic settings list rather than a real search
 * history. The "Recent searches (N)" + "Edit" header row also matches
 * that reference (a plain text action, not a styled button) — tapping
 * "Edit" clears all recent searches directly (this app has no
 * per-row-delete affordance to enter a real edit mode for, so "Edit" and
 * "Clear all" collapse to the same action here; a real per-row swipe-to-
 * delete would be the next step if this list grows a genuine edit mode).
 *
 * Recent searches persist across app restarts via
 * `recent-searches-storage.ts` (`expo-secure-store`, same mechanism
 * `theme-storage.ts` already uses) — a query is recorded once the user
 * actually opens a result, not on every keystroke.
 *
 * Selecting a result links to `/search/[slug]` (this tab's OWN copy of the
 * detail route), not `/components/[slug]` — see that file's own doc
 * comment for the real, user-reported back-navigation bug this fixes.
 *
 * Row spacing uses `ItemSeparatorComponent`, NOT a `gap-2` on
 * `contentContainerClassName` — a real, user-reported bug: unlike a plain
 * `ScrollView` (every other list in this app), `FlatList`'s content
 * container is rendered by `VirtualizedList` internally, and NativeWind's
 * `gap-*` utility didn't apply there, so results rendered flush with no
 * space between rows. `ItemSeparatorComponent` is RN's own supported
 * mechanism for inter-item spacing and isn't subject to this gap. Content
 * padding is likewise a plain numeric `contentContainerStyle`, not
 * `contentContainerClassName`, for the same underlying reason.
 *
 * `contentInsetAdjustmentBehavior="automatic"` (both platforms) — the
 * correct mechanism now that the header (large title + search bar, or the
 * small title `hideNavigationBar: false` keeps visible while searching)
 * genuinely stays present; see this file's git history for two earlier,
 * reverted attempts at hand-computing top padding instead, both of which
 * regressed once the header's actual presence/height changed.
 */
type Row = { kind: "result"; entry: ComponentCatalogEntry } | { kind: "recent"; query: string };

export default function SearchScreen() {
  const colors = useNativeColors();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getRecentSearches().then(setRecent);
    }, []),
  );

  const isSearching = query.trim().length > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return COMPONENT_CATALOG.filter((entry) => entry.title.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q));
  }, [query]);

  const rows: Row[] = useMemo(() => {
    if (isSearching) return results.map((entry) => ({ kind: "result", entry }) as const);
    return recent.map((q) => ({ kind: "recent", query: q }) as const);
  }, [isSearching, results, recent]);

  const recordSearch = useCallback(async (value: string) => {
    const next = await addRecentSearch(value);
    setRecent(next);
  }, []);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecent([]);
  }, []);

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {Platform.OS === "ios" ? (
        <Stack.Screen
          options={{
            headerSearchBarOptions: {
              placeholder: "Search components",
              autoCapitalize: "none",
              hideWhenScrolling: false,
              hideNavigationBar: false,
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

      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={rows}
        keyExtractor={(row) => (row.kind === "result" ? row.entry.slug : `recent-${row.query}`)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 16 }}
        ItemSeparatorComponent={() => <View className={isSearching ? "h-2" : "h-6"} />}
        ListHeaderComponent={
          !isSearching && recent.length > 0 ? (
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[20px] font-semibold text-on-surface dark:text-on-surface-dark">
                Recent searches ({recent.length})
              </Text>
              <Pressable onPress={handleClearRecent} hitSlop={8}>
                <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">Edit</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isSearching ? (
            <EmptyState
              icon={<SearchIcon size={24} color={colors.onSurfaceMuted} />}
              title="No components found"
              description={`Nothing matches "${query}".`}
            />
          ) : (
            <EmptyState
              className="pt-12"
              icon={<SearchIcon size={24} color={colors.onSurfaceMuted} />}
              title="Search components"
              description="Find any component by name or description."
            />
          )
        }
        renderItem={({ item: row }) =>
          row.kind === "result" ? (
            <Link href={`/search/${row.entry.slug}`} asChild>
              <Pressable
                onPress={() => recordSearch(query)}
                className="flex-row items-center justify-between rounded-lg border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
              >
                <View className="flex-1 gap-0.5 pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{row.entry.title}</Text>
                    {row.entry.native ? (
                      <View className="rounded-full bg-info-bg px-1.5 py-0.5 dark:bg-info-bg-dark">
                        <Text className="text-[10px] font-medium text-info dark:text-info-dark">Native</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{row.entry.description}</Text>
                </View>
                <ChevronRight size={18} color={colors.onSurfaceMuted} />
              </Pressable>
            </Link>
          ) : (
            <Pressable onPress={() => setQuery(row.query)}>
              <Text className="text-[17px] font-semibold text-on-surface dark:text-on-surface-dark">{row.query}</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}
