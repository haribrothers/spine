/**
 * Single source of truth for which @spine/ui-native components this app
 * documents — mirrors apps/design-system/src/lib/nav.ts's role for web.
 * Adding a new packages/ui-native component means adding its screen under
 * app/components/<name>.tsx AND an entry here, per CLAUDE.md's "ships with
 * its doc page in the same change" rule.
 */
export interface ComponentRegistryEntry {
  slug: string;
  name: string;
  description: string;
}

export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  { slug: "button", name: "Button", description: "Primary, secondary, danger, and ghost variants with loading/disabled states." },
  { slug: "text-field", name: "Text Field", description: "Single-line text input with an error state." },
  { slug: "card", name: "Card", description: "Card, Header, Title, Description, Content, and Footer composition." },
  { slug: "badge", name: "Badge", description: "Neutral inline label — never used for financial status." },
  {
    slug: "tab-bar",
    name: "Bottom Tab Bar",
    description: "Themed screenOptions and icon helper for createBottomTabNavigator.",
  },
];
