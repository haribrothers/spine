export interface TemplateCatalogEntry {
  slug: string;
  title: string;
  description: string;
}

/** Same lightweight pattern as `component-catalog.ts` — one array driving the Templates tab's list UI. */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  { slug: "list-detail", title: "List + Detail", description: "A scrollable list pushing to a detail screen — the Jobs-list shape." },
  { slug: "settings", title: "Settings", description: "Grouped settings rows with Switch/Select controls — the Profile-tab shape." },
];
