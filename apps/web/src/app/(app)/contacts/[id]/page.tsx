import { AppShellHeader } from "@spine/ui";
import { ContactDetail } from "../contact-detail";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Sales" }, { label: "Contacts", href: "/contacts" }, { label: "Detail" }]} title="Contact" />
      <ContactDetail contactId={id} />
    </>
  );
}
