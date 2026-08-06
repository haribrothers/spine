import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../components/app-layout";
import { getSession } from "../../lib/get-session";
import { NAV_SECTIONS } from "../../lib/nav-sections";
import { ContactsExplorer } from "./contacts-explorer";

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
  const session = await getSession();
  const { new: newParam } = await searchParams;

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Contacts" }]}
        title="Contacts"
        description="Customers and vendors you do business with."
      />
      <ContactsExplorer initialDrawerOpen={newParam === "1"} />
    </AppLayout>
  );
}
