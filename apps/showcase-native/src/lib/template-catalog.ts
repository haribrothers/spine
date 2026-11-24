export interface TemplateCatalogEntry {
  slug: string;
  title: string;
  description: string;
  /**
   * Overrides the default `/templates/${slug}` link target. Only needed for
   * "Edit" — that route now lives at the top-level `app/job-edit/[jobId]`
   * (OUTSIDE the tabs group entirely), not under `app/(tabs)/templates/`
   * like every other template, so the tab bar doesn't stay mounted over the
   * screen (see `job-edit/[jobId].tsx`'s own doc comment for the full
   * "why move it out of the tabs group" rationale).
   */
  href?: string;
}

/** Same lightweight pattern as `component-catalog.ts` — one array driving the Templates tab's list UI. */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  { slug: "list-detail", title: "List + Detail", description: "A scrollable list pushing to a detail screen — the Jobs-list shape." },
  { slug: "settings", title: "Settings", description: "Grouped settings rows with Switch/Select controls — the Profile-tab shape." },
  {
    slug: "edit",
    title: "Edit",
    description: "A form screen with grouped sections, validation, a sticky save/cancel footer, and an unsaved-changes guard.",
    href: "/job-edit/1",
  },
];
