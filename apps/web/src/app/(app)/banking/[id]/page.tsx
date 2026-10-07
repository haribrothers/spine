import { AccountRegisterView } from "../account-register";

/** US-BANK-02 — one money account's register. */
export default async function AccountRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountRegisterView accountId={id} />;
}
