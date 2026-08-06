import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../components/app-layout";
import { getSession } from "../../../lib/get-session";
import { NAV_SECTIONS } from "../../../lib/nav-sections";
import { ContactDetail } from "../contact-detail";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader breadcrumb={[{ label: "Sales" }, { label: "Contacts", href: "/contacts" }, { label: "Detail" }]} title="Contact" />
      <ContactDetail contactId={id} />
    </AppLayout>
  );
}
