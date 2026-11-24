import { ExpensesHeader } from "../expenses-header";
import { ExpenseCategoriesView } from "./expense-categories-view";

/** US-PUR-19 — Expenses › Categories. Who can open it is decided by `pageAccessFor` (lib/page-access.ts). */
export default function ExpenseCategoriesPage() {
  return (
    <>
      <ExpensesHeader active="categories" />
      <ExpenseCategoriesView />
    </>
  );
}
