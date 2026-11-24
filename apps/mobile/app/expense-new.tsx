import { useLocalSearchParams } from "expo-router";
import { NewExpenseScreen } from "../src/features/expenses/new-expense-screen";

export default function NewExpense() {
  const { scan, edit } = useLocalSearchParams<{ scan?: string; edit?: string }>();
  return <NewExpenseScreen scan={scan === "1"} editId={edit} />;
}
