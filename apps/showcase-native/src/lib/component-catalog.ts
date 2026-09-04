/**
 * The single static array driving the Components tab's list UI
 * (`app/(tabs)/components/index.tsx`, which maps over this to render nav
 * rows linking to `/components/[slug]`). Per the plan's decision 5, this
 * deliberately does NOT replicate `apps/design-system-native`'s two-file
 * `nav-sections.ts`+`component-screens.ts` pattern — `expo-router` already
 * derives real routes from the filesystem, so a parallel hand-maintained
 * slug→component map would be redundant with the router itself. This is a
 * lighter version of the same idea, sized to what file-based routing
 * actually needs: one array for the list UI, plus `[slug].tsx`'s own
 * sibling `component-demos.ts` map for rendering the right demo per slug.
 *
 * `native` marks components backed by `@expo/ui` (real SwiftUI/Jetpack
 * Compose views via a `Host` bridge); the rest stay RN+NativeWind (no
 * native equivalent exists — see CLAUDE.md's ui-native section).
 */
export interface ComponentCatalogEntry {
  slug: string;
  title: string;
  description: string;
  native: boolean;
}

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  { slug: "button", title: "Button", description: "Filled, outlined, and text actions — real SwiftUI/Compose Button.", native: true },
  { slug: "switch", title: "Switch", description: "A native on/off toggle.", native: true },
  { slug: "select", title: "Select", description: "A native picker (menu or wheel appearance).", native: true },
  { slug: "slider", title: "Slider", description: "A native single-value slider.", native: true },
  { slug: "context-menu", title: "Context Menu", description: "A native long-press/tap menu with destructive and checked actions.", native: true },
  { slug: "date-time-picker", title: "Date & Time Picker", description: "A native date, time, or datetime picker.", native: true },
  { slug: "bottom-sheet", title: "Bottom Sheet", description: "A native modal sheet that slides up from the bottom.", native: true },
  { slug: "text-field", title: "Text Field", description: "A themed text input with an error state.", native: false },
  { slug: "card", title: "Card", description: "A grouping container with Header/Title/Description/Content/Footer.", native: false },
  { slug: "badge", title: "Badge", description: "A neutral pill label for tags and metadata.", native: false },
  { slug: "status-chip", title: "Status Chip", description: "The reserved paid/due-soon/overdue/draft palette.", native: false },
  { slug: "avatar", title: "Avatar", description: "A circular image or initials placeholder.", native: false },
  { slug: "empty-state", title: "Empty State", description: "Icon, title, description, and action for a zero-results screen.", native: false },
  { slug: "spinner", title: "Spinner", description: "An indeterminate loading indicator.", native: false },
  { slug: "skeleton", title: "Skeleton", description: "A pulsing placeholder block.", native: false },
  { slug: "toast", title: "Toast", description: "An auto-dismissing confirmation message.", native: false },
];
