import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../../components/app-layout";
import { getSession } from "../../../../lib/get-session";
import { NAV_SECTIONS } from "../../../../lib/nav-sections";
import { QuoteEditLoader } from "../../quote-edit-loader";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "Edit" }]}
        title="Edit quote"
        description="Only a draft can be edited directly — a sent quote is revised into a new version instead."
      />
      <QuoteEditLoader quoteId={id} />
    </AppLayout>
  );
}
