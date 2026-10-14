import { Suspense } from "react";
import { AccountRegisterView } from "../account-register";

/** US-BANK-02, US-BANK-14 — one money account's register; its view is kept in the address. */
export default async function AccountRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AccountRegisterView accountId={id} />
    </Suspense>
  );
}
