import { ReconciliationsHistory } from "../../reconciliations-history";

/** US-BANK-11 — an account's finished reconciliations; undo the latest. */
export default async function ReconciliationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReconciliationsHistory accountId={id} />;
}
