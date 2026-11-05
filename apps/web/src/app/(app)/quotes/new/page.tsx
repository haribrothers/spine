import { AppShellHeader } from "@spine/ui";
import { QuoteBuilder } from "../quote-builder";
import { t } from "../../../../lib/i18n";

/** `?leadId=` starts the quote from a pipeline lead (US-CRM-26): its contact, its currency, and linked to it. */
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("quotes.breadcrumb.sales") }, { label: t("quotes.breadcrumb.quotes"), href: "/quotes" }, { label: t("quotes.breadcrumb.new") }]}
        title={t("quotes.newPage.title")}
        description={t("quotes.newPage.description")}
      />
      <QuoteBuilder leadId={leadId} />
    </>
  );
}
