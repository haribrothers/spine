import { AppShellHeader } from "@spine/ui";
import { ContactsExplorer } from "./contacts-explorer";
import { t } from "../../../lib/i18n";

/**
 * S-01.1/S-01.2 — the contacts list (F1 MUST: store companies/individuals,
 * mark customer/vendor/both), rebuilt this session (Phase 2) with stat
 * cards, a Table/List/Card view switcher, multiselect filters, and a
 * Drawer-based create flow — see ContactsExplorer for the client-side
 * state that used to live directly in this page's old ContactsTable.
 *
 * `?new=1` auto-opens the create Drawer (read server-side here, not
 * client-side, so the very first paint already reflects it) — this is what
 * `/contacts/new` now redirects to (see that route's own comment for the
 * drawer-vs-route reasoning) and gives the drawer a shareable/bookmarkable
 * URL of its own without a second route.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: newParam } = await searchParams;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("contacts.page.breadcrumbSales") }, { label: t("contacts.page.title") }]}
        title={t("contacts.page.title")}
        description={t("contacts.page.description")}
      />
      <ContactsExplorer initialDrawerOpen={newParam === "1"} />
    </>
  );
}
