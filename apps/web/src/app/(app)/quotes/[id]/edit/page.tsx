import { AppShellHeader } from "@spine/ui";
import { QuoteEditLoader } from "../../quote-edit-loader";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "Edit" }]}
        title="Edit quote"
        description="Only a draft can be edited directly — a sent quote is revised into a new version instead."
      />
      <QuoteEditLoader quoteId={id} />
    </>
  );
}
