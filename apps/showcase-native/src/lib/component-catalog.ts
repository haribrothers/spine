/**
 * The single static array driving the Components tab's list UI
 * (`app/(tabs)/components/index.tsx`, which maps over this to render nav
 * rows linking to `/components/[slug]`). Per the plan's decision 5, this
 * deliberately has no hand-written navigation table — `expo-router` already
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
  { slug: "full-width-button", title: "Full Width Button", description: "A genuinely full-width native button.", native: true },
  { slug: "switch", title: "Switch", description: "A native on/off toggle.", native: true },
  { slug: "select", title: "Select", description: "A native picker (menu or wheel appearance).", native: true },
  { slug: "select-field", title: "Select Field", description: "A themed form-row wrapper around a short, fixed-enum native select.", native: true },
  { slug: "select-list-field", title: "Select List Field", description: "A searchable bottom-sheet select for long option lists.", native: true },
  { slug: "segmented-control", title: "Segmented Control", description: "A native segmented picker for a small set of mutually exclusive options.", native: true },
  { slug: "slider", title: "Slider", description: "A native single-value slider.", native: true },
  { slug: "context-menu", title: "Context Menu", description: "A native long-press/tap menu with destructive and checked actions.", native: true },
  { slug: "date-time-picker", title: "Date & Time Picker", description: "A native date, time, or datetime picker.", native: true },
  { slug: "bottom-sheet", title: "Bottom Sheet", description: "A native modal sheet that slides up from the bottom.", native: true },
  { slug: "text-field", title: "Text Field", description: "A themed text input with an error state.", native: false },
  { slug: "native-text-field", title: "Native Text Field", description: "A real native SwiftUI text field (iOS-only pilot).", native: true },
  { slug: "floating-label-field", title: "Floating Label Field", description: "A Material-style floating-label text field.", native: false },
  { slug: "outlined-text-field", title: "Outlined Text Field", description: "Material 3's outlined field, the Android form look in the field app.", native: false },
  { slug: "form-row", title: "Form Row / Form Section", description: "The grouped-card form layout — a captioned card of fixed-height rows.", native: false },
  { slug: "divider", title: "Divider", description: "A full-bleed 1px row separator for inside a form card.", native: false },
  { slug: "scroll-edge-mask", title: "Scroll Edge Mask", description: "A background fade over a scroll view's top or bottom edge (Android).", native: false },
  { slug: "stepper", title: "Stepper", description: "A numeric +/- stepper.", native: false },
  { slug: "card", title: "Card", description: "A grouping container with Header/Title/Description/Content/Footer.", native: false },
  { slug: "badge", title: "Badge", description: "A neutral pill label for tags and metadata.", native: false },
  { slug: "status-chip", title: "Status Chip", description: "The reserved paid/due-soon/overdue/draft palette.", native: false },
  { slug: "avatar", title: "Avatar", description: "A circular image or initials placeholder.", native: false },
  { slug: "empty-state", title: "Empty State", description: "Icon, title, description, and action for a zero-results screen.", native: false },
  { slug: "spinner", title: "Spinner", description: "An indeterminate loading indicator.", native: false },
  { slug: "skeleton", title: "Skeleton", description: "A pulsing placeholder block.", native: false },
  { slug: "toast", title: "Toast", description: "An auto-dismissing confirmation message.", native: false },
  { slug: "gauge-indicator", title: "Gauge Indicator", description: "A semi-circular animated progress gauge.", native: false },
  { slug: "kpi-card", title: "KPI Card", description: "A gradient-filled stat card with label, value, trend, and icon.", native: false },
  { slug: "action-tile", title: "Action Tile", description: "An icon + label tile for a wrapping quick-actions grid.", native: false },
  { slug: "spine-logo", title: "Spine Logo", description: "The layered mark and the SPiNE wordmark, in three forms.", native: false },
];
