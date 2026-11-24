import { CreditNoteDetail } from "../credit-note-detail";

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    // US-INV-38: the credit note renders its own header, with its number as the page title.
    <CreditNoteDetail creditNoteId={id} />
  );
}
