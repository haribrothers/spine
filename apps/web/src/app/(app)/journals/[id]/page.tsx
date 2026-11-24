import { JournalDetail } from "../journal-detail";

/** US-RPT-20, US-RPT-21 — one manual journal. */
export default async function JournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalDetail journalId={id} />;
}
