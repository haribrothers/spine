import { FlatList, Pressable, Text, View } from "react-native";
import type { DocEntry } from "../src/lib/nav-sections";

/**
 * A section's item list — one per top-level nav section (Overview,
 * Foundation, Layouts, Components, Templates), each rendered inside that
 * section's own native-stack as its initial screen. Pressing an item pushes
 * to that stack's Detail screen.
 */
export function SectionListScreen({ items, onSelect }: { items: DocEntry[]; onSelect: (slug: string) => void }) {
  return (
    <FlatList
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="p-4 gap-2"
      data={items}
      keyExtractor={(item) => item.slug}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelect(item.slug)}
          className="gap-1 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-4 active:bg-surface-sunken active:dark:bg-surface-sunken-dark"
        >
          <Text className="text-[15px] font-semibold text-on-surface dark:text-on-surface-dark">{item.name}</Text>
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{item.description}</Text>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
    />
  );
}
