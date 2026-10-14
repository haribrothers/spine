import { ReconciliationReport } from "../../../reconciliation-report";

/** US-BANK-17 — a finished reconciliation, read-only, with its report. */
export default async function ReconciliationPage({ params }: { params: Promise<{ id: string; reconciliationId: string }> }) {
  const { id, reconciliationId } = await params;
  return <ReconciliationReport accountId={id} reconciliationId={reconciliationId} />;
}
