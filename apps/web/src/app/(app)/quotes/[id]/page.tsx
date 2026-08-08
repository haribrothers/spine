import { AppShellHeader } from "@spine/ui";
import { getSession } from "../../../../lib/get-session";
import { QuoteDetail } from "../quote-detail";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "Detail" }]} title="Quote" />
      <QuoteDetail quoteId={id} currentUserId={session?.user?.id ?? null} />
    </>
  );
}
