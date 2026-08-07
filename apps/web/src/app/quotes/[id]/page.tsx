import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../components/app-layout";
import { getSession } from "../../../lib/get-session";
import { NAV_SECTIONS } from "../../../lib/nav-sections";
import { QuoteDetail } from "../quote-detail";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "Detail" }]} title="Quote" />
      <QuoteDetail quoteId={id} currentUserId={session?.user?.id ?? null} />
    </AppLayout>
  );
}
