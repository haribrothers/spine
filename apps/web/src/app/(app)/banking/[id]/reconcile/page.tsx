import { ReconcileAccount } from "../../reconcile-account";

/** US-BANK-08 — reconcile one money account against its statement. */
export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReconcileAccount accountId={id} />;
}
