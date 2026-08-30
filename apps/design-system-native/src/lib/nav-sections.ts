import type { ComponentType } from "react";
import Compass from "lucide-react-native/icons/compass";
import Palette from "lucide-react-native/icons/palette";
import LayoutGrid from "lucide-react-native/icons/layout-grid";
import Component from "lucide-react-native/icons/component";
import LayoutTemplate from "lucide-react-native/icons/layout-template";
import type { LucideIcon } from "lucide-react-native";

/**
 * Single source of truth for this app's top-level information architecture —
 * mirrors apps/design-system/src/lib/nav.ts's five top-level sections
 * (Overview, Foundation, Layouts, Components, Templates), just flattened
 * (no per-section sub-groups yet, since RN doesn't have that much content
 * per section). Mobile renders one FloatingTabBar tab per section (each its
 * own List->Detail stack); desktop renders each section as its own labeled
 * group in DesktopSidebar. Adding a new @spine/ui-native doc page means
 * adding its screen under app/**.tsx AND an entry to the right section's
 * `items` here, per CLAUDE.md's "ships with its doc page in the same
 * change" rule.
 */
export interface DocEntry {
  slug: string;
  name: string;
  description: string;
}

export type SectionSlug = "overview" | "foundation" | "layouts" | "components" | "templates";

export interface DocSection {
  slug: SectionSlug;
  title: string;
  icon: LucideIcon;
  items: DocEntry[];
}

export const NAV_SECTIONS: DocSection[] = [
  {
    slug: "overview",
    title: "Overview",
    icon: Compass,
    items: [{ slug: "introduction", name: "Introduction", description: "What @spine/ui-native is and how this app documents it." }],
  },
  {
    slug: "foundation",
    title: "Foundation",
    icon: Palette,
    items: [{ slug: "tokens", name: "Tokens", description: "Color, typography, spacing, and icon tokens shared with @spine/ui." }],
  },
  {
    slug: "layouts",
    title: "Layouts",
    icon: LayoutGrid,
    items: [{ slug: "app-shell", name: "App shell", description: "Structural primitives for screen layout." }],
  },
  {
    slug: "components",
    title: "Components",
    icon: Component,
    items: [
      { slug: "button", name: "Button", description: "Primary, secondary, danger, and ghost variants with loading/disabled states." },
      { slug: "text-field", name: "Text Field", description: "Single-line text input with an error state." },
      { slug: "card", name: "Card", description: "Card, Header, Title, Description, Content, and Footer composition." },
      { slug: "badge", name: "Badge", description: "Neutral inline label — never used for financial status." },
      { slug: "tab-bar", name: "Bottom Tab Bar", description: "Themed screenOptions and icon helper for createBottomTabNavigator." },
      { slug: "floating-tab-bar", name: "Floating Tab Bar", description: "Fully custom floating pill tab bar with an active-tab highlight capsule." },
    ],
  },
  {
    slug: "templates",
    title: "Templates",
    icon: LayoutTemplate,
    items: [{ slug: "sample-screens", name: "Sample screens", description: "End-to-end example screens composed from @spine/ui-native." }],
  },
];

export function findSection(slug: SectionSlug): DocSection {
  const section = NAV_SECTIONS.find((s) => s.slug === slug);
  if (!section) throw new Error(`Unknown nav section "${slug}"`);
  return section;
}

export function flatDocEntries(): (DocEntry & { section: SectionSlug; sectionTitle: string })[] {
  return NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.slug, sectionTitle: section.title })),
  );
}

export type DocScreenMap = Record<SectionSlug, Record<string, ComponentType>>;
