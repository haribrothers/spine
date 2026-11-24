import { apiClient } from "./api-client";
import { t } from "./i18n";

/** One source of the customer's credit: an unallocated payment or a credit note's spare credit. */
export interface CustomerCredit {
  kind: "payment" | "credit_note";
  id: string;
  label: string;
  date: string | null;
  available: bigint;
}

/** The customer's credit, oldest first (US-PAY-16): unallocated payments and credit notes with credit left. */
export async function loadCustomerCredit(contactId: string): Promise<CustomerCredit[]> {
  const [payments, notes] = await Promise.all([
    apiClient.get<{ id: string; number: string | null; date: string; unallocatedAmount: string }[]>(`/payments?contactId=${contactId}`).catch(() => []),
    apiClient.get<{ id: string; number: string | null; date: string | null; status: string; creditRemainingAmount?: string }[]>(`/credit-notes?contactId=${contactId}`).catch(() => []),
  ]);
  return [
    ...payments.filter((p) => BigInt(p.unallocatedAmount) > 0n).map((p) => ({ kind: "payment" as const, id: p.id, label: t("payments.customerCredit.payment", { number: p.number ?? "" }).trim(), date: p.date, available: BigInt(p.unallocatedAmount) })),
    ...notes
      .filter((n) => n.status === "issued" && BigInt(n.creditRemainingAmount ?? "0") > 0n)
      .map((n) => ({ kind: "credit_note" as const, id: n.id, label: t("payments.customerCredit.creditNote", { number: n.number ?? "" }).trim(), date: n.date, available: BigInt(n.creditRemainingAmount!) })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}
