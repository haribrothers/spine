import { Platform, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemeToggle } from "./theme-toggle";

/** RN port of apps/design-system's top-bar.tsx — a single "Spine" section here (no multi-section nav yet, since this app only documents one library today). */
export function DesktopTopBar({ onSearchOpen }: { onSearchOpen: () => void }) {
  return (
    <View className="h-14 flex-row items-center gap-6 border-b border-border bg-surface px-6">
      <Text className="text-[15px] font-semibold tracking-tight text-on-surface">Spine</Text>
      <Text className="flex-1 text-[13px] font-medium text-on-surface-muted">@spine/ui-native</Text>

      <Pressable
        accessibilityRole="button"
        onPress={onSearchOpen}
        className="flex-row items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-1.5"
      >
        <Feather name="search" size={14} color="#726C5A" />
        <Text className="text-[13px] text-on-surface-muted">Search</Text>
        {Platform.OS === "web" ? (
          <Text className="ml-2 rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[11px] text-on-surface-muted">
            ⌘K
          </Text>
        ) : null}
      </Pressable>

      <ThemeToggle />
    </View>
  );
}
