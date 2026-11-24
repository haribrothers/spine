import { getSession } from "../../../../lib/get-session";
import { QuoteDetail } from "../quote-detail";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return (
    // US-QUO-31: the quote renders its own header, with its number as the page title.
    <QuoteDetail quoteId={id} currentUserId={session?.user?.id ?? null} />
  );
}
