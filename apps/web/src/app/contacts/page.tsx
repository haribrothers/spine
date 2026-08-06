import { AppShellHeader, Button } from "@spine/ui";
import Link from "next/link";
import { AppLayout } from "../../components/app-layout";
import { getSession } from "../../lib/get-session";
import { NAV_SECTIONS } from "../../lib/nav-sections";
import { ContactsTable } from "./contacts-table";

/**
 * S-01.1/S-01.2 — the contacts list (F1 MUST: store companies/individuals,
 * mark customer/vendor/both). Data loads client-side (ContactsTable) rather
 * than server-side here, since the list needs to re-fetch after a create
 * without a full page reload — matches the pattern already established by
 * the Settings dialog panes (apps/web/src/app/settings/panes/*).
 */
export default async function ContactsPage() {
  const session = await getSession();

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
        action={
          <Button asChild>
            <Link href="/contacts/new">Add contact</Link>
          </Button>
        }
      />
      <ContactsTable />
    </AppLayout>
  );
}
