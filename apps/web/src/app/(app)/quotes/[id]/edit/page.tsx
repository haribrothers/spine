import { AppShellHeader } from "@spine/ui";
import { QuoteEditLoader } from "../../quote-edit-loader";
import { t } from "../../../../../lib/i18n";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("quotes.breadcrumb.sales") }, { label: t("quotes.breadcrumb.quotes"), href: "/quotes" }, { label: t("quotes.breadcrumb.edit") }]}
        title={t("quotes.editPage.title")}
        description={t("quotes.editPage.description")}
      />
      <QuoteEditLoader quoteId={id} />
    </>
  );
}
