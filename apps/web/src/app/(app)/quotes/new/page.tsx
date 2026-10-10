import { AppShellHeader } from "@spine/ui";
import { QuoteBuilder } from "../quote-builder";

/** `?leadId=` starts the quote from a pipeline lead (US-CRM-26): its contact, its currency, and linked to it. */
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "New" }]}
        title="New quote"
        description="Build a multi-line quote. It saves as a draft until you send it."
      />
      <QuoteBuilder leadId={leadId} />
    </>
  );
}
