import { getSession } from "../../../../lib/get-session";
import { ExpenseDetail } from "../expense-detail";

/** US-PUR-43 — an expense on its own page; it renders its own header. Field reach only their own (the API answers 404 otherwise). */
export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  return <ExpenseDetail expenseId={id} currentUserId={session?.user?.id ?? null} />;
}
