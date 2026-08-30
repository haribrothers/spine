import { Pressable, ScrollView, Text } from "react-native";
import { COMPONENT_REGISTRY } from "../lib/component-registry";

/**
 * RN port of apps/design-system's sidebar.tsx — a single "Components" group, matching this app's current single-section nav.
 *
 * Width is an inline style, not a NativeWind `w-56`/`shrink-0` className:
 * on ScrollView + react-native-web those width/flex classNames were
 * silently dropped from the compiled CSS (confirmed by inspecting a real
 * `expo export --platform web` bundle — `w-56`/`shrink-0` never appeared in
 * the output CSS at all), which is what caused the sidebar to render at
 * full width instead of 224px. Don't revert this to a className.
 */
export function DesktopSidebar({ selectedSlug, onSelect }: { selectedSlug: string; onSelect: (slug: string) => void }) {
  return (
    <ScrollView
      style={{ width: 224, flexGrow: 0, flexShrink: 0 }}
      className="border-r border-border bg-background"
      contentContainerClassName="gap-0.5 p-4"
    >
      <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted">Components</Text>
      {COMPONENT_REGISTRY.map((item) => {
        const isActive = item.slug === selectedSlug;
        return (
          <Pressable
            key={item.slug}
            accessibilityRole="button"
            onPress={() => onSelect(item.slug)}
            className={["rounded-md px-2 py-1.5", isActive ? "bg-surface-sunken" : ""].join(" ")}
          >
            <Text className={["text-[13px]", isActive ? "font-medium text-primary" : "text-on-surface-muted"].join(" ")}>
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
