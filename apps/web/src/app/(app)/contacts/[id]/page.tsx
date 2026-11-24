import { AppShellHeader } from "@spine/ui";
import { ContactDetail } from "../contact-detail";
import { t } from "../../../../lib/i18n";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: t("contacts.page.breadcrumbSales") }, { label: t("contacts.page.title"), href: "/contacts" }, { label: t("contacts.page.breadcrumbDetail") }]} title={t("contacts.page.detailTitle")} />
      <ContactDetail contactId={id} />
    </>
  );
}
