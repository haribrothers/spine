import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Platform, Pressable, Text, TextInput } from "react-native";
import { COMPONENT_REGISTRY, type ComponentRegistryEntry } from "../lib/component-registry";

/**
 * RN port of apps/design-system's search-palette.tsx: a modal overlay
 * filtering the same component registry the sidebar/home screen use.
 * `cmdk` itself is DOM-only (built on web-specific portal/keyboard
 * behavior), so this re-implements the same "type to filter, press to
 * select" behavior with RN's Modal/TextInput/FlatList instead of porting
 * the library. Cmd/Ctrl+K global capture is web-only (native has no
 * hardware-keyboard-driven command-palette convention); native users open
 * it via the top bar's search button only.
 */
export function SearchPalette({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const results = useMemo<ComponentRegistryEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMPONENT_REGISTRY;
    return COMPONENT_REGISTRY.filter(
      (item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
      <Pressable className="flex-1 items-center bg-black/30 pt-[15vh]" onPress={() => onOpenChange(false)}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface"
        >
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search components…"
            placeholderTextColor="#726C5A"
            className="border-b border-border px-4 py-3 text-[14px] text-on-surface"
          />
          <FlatList
            className="max-h-80"
            contentContainerClassName="p-2"
            data={results}
            keyExtractor={(item) => item.slug}
            ListEmptyComponent={<Text className="px-2 py-6 text-center text-[13px] text-on-surface-muted">No results found.</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item.slug);
                  onOpenChange(false);
                }}
                className="flex-row items-center justify-between rounded-md px-2 py-2 active:bg-surface-sunken"
              >
                <Text className="text-[13px] text-on-surface">{item.name}</Text>
                <Text className="text-[12px] text-on-surface-muted">Components</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
