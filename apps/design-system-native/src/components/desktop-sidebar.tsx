import { Pressable, ScrollView, Text } from "react-native";
import { findSection, type SectionSlug } from "../lib/nav-sections";

/**
 * RN port of apps/design-system's sidebar.tsx — renders only the ACTIVE
 * top-level section's items (matching web's `activeTop.sections`), since
 * section switching itself now lives in DesktopTopBar's pill nav, not here.
 *
 * Width is an inline style, not a NativeWind `w-56`/`shrink-0` className:
 * on ScrollView + react-native-web those width/flex classNames were
 * silently dropped from the compiled CSS (confirmed by inspecting a real
 * `expo export --platform web` bundle — `w-56`/`shrink-0` never appeared in
 * the output CSS at all), which is what caused the sidebar to render at
 * full width instead of 224px. Don't revert this to a className.
 */
export function DesktopSidebar({
  activeSection,
  selectedSlug,
  onSelect,
}: {
  activeSection: SectionSlug;
  selectedSlug: string;
  onSelect: (slug: string, section: SectionSlug) => void;
}) {
  const section = findSection(activeSection);

  return (
    <ScrollView
      style={{ width: 224, flexGrow: 0, flexShrink: 0 }}
      className="border-r border-border dark:border-border-dark bg-background dark:bg-background-dark"
      contentContainerClassName="gap-0.5 p-4"
    >
      <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
        {section.title}
      </Text>
      {section.items.map((item) => {
        const isActive = item.slug === selectedSlug;
        return (
          <Pressable
            key={item.slug}
            accessibilityRole="button"
            onPress={() => onSelect(item.slug, section.slug)}
            className={["rounded-md px-2 py-1.5", isActive ? "bg-surface-sunken dark:bg-surface-sunken-dark" : ""].join(" ")}
          >
            <Text
              className={[
                "text-[13px]",
                isActive ? "font-medium text-primary dark:text-primary-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark",
              ].join(" ")}
            >
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
