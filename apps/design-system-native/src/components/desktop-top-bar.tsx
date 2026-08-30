import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Search from "lucide-react-native/icons/search";
import { NAV_SECTIONS, type SectionSlug } from "../lib/nav-sections";
import { ThemeToggle } from "./theme-toggle";

/**
 * RN port of apps/design-system's top-bar.tsx: "Spine" wordmark, a pill-style
 * section nav (Overview/Foundation/Layouts/Components/Templates — the
 * active section highlighted, matching web's `bg-surface-sunken text-primary`
 * treatment) directly in the top bar, then Search/theme toggle on the right.
 * Section switching lives HERE, not in DesktopSidebar — DesktopSidebar shows
 * only the active section's own item groups, exactly like web's Sidebar
 * (`activeTop.sections`) reads its active top-level section from the URL and
 * the top bar owns cross-section navigation.
 */
export function DesktopTopBar({
  selectedSection,
  onSelectSection,
  onSearchOpen,
}: {
  selectedSection: SectionSlug;
  onSelectSection: (section: SectionSlug) => void;
  onSearchOpen: () => void;
}) {
  return (
    <View className="h-14 flex-row items-center gap-6 border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark px-6">
      <Text className="text-[15px] font-semibold tracking-tight text-on-surface dark:text-on-surface-dark">Spine</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="flex-row items-center gap-1">
        {NAV_SECTIONS.map((section) => {
          const isActive = section.slug === selectedSection;
          return (
            <Pressable
              key={section.slug}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectSection(section.slug)}
              className={["rounded-md px-3 py-1.5", isActive ? "bg-surface-sunken dark:bg-surface-sunken-dark" : ""].join(" ")}
            >
              <Text
                className={[
                  "text-[13px] font-medium",
                  isActive ? "text-primary dark:text-primary-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark",
                ].join(" ")}
              >
                {section.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={onSearchOpen}
        className="flex-row items-center gap-2 rounded-md border border-border dark:border-border-dark bg-surface-sunken dark:bg-surface-sunken-dark px-3 py-1.5"
      >
        <Search size={14} color="#726C5A" />
        <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Search</Text>
        {Platform.OS === "web" ? (
          <Text className="ml-2 rounded border border-border-strong dark:border-border-strong-dark bg-surface dark:bg-surface-dark px-1.5 py-0.5 font-mono text-[11px] text-on-surface-muted dark:text-on-surface-muted-dark">
            ⌘K
          </Text>
        ) : null}
      </Pressable>

      <ThemeToggle />
    </View>
  );
}
