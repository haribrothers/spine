import { useLocalSearchParams } from "expo-router";
import { ExpenseScreen } from "../../../src/features/expenses/expense-screen";

export default function Expense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseScreen id={id} />;
}
