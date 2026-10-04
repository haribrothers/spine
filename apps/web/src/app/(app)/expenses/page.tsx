import { getSession } from "../../../lib/get-session";
import { ExpensesExplorer } from "./expenses-explorer";
import { ExpensesHeader } from "./expenses-header";

/**
 * PRD FEAT-07 (S-07.2/S-07.3 submit, S-07.4 approve/reject). Field-reachable
 * per ExpensesController's own doc comment — a field user needs to see and
 * edit their own still-submitted expenses, so this page is never gated
 * client-side beyond what the API already enforces (see nav-sections.tsx).
 * `currentUserId` (server-side session read, same pattern as
 * jobs/[id]/page.tsx) is passed down so the explorer can resolve the
 * viewer's own role for the Approve/Reject gate in the detail drawer.
 */
export default async function ExpensesPage() {
  const session = await getSession();

  return (
    <>
      <ExpensesHeader active="expenses" />
      <ExpensesExplorer currentUserId={session?.user?.id ?? null} />
    </>
  );
}
