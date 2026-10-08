import { Text, View } from "react-native";
import type { MyExpense } from "../lib/data/expenses";

/** "Submitted" (info blue), "Approved" (paid green), "Rejected" (overdue red), as drawn. */
const STYLE: Record<MyExpense["status"] | "waiting", { label: string; box: string; text: string }> = {
  submitted: { label: "Submitted", box: "bg-info-bg dark:bg-info-bg-dark", text: "text-primary dark:text-primary-dark" },
  approved: { label: "Approved", box: "bg-paid-bg dark:bg-paid-bg-dark", text: "text-paid dark:text-paid-dark" },
  rejected: { label: "Rejected", box: "bg-overdue-bg dark:bg-overdue-bg-dark", text: "text-overdue dark:text-overdue-dark" },
  waiting: { label: "Waiting", box: "bg-draft-bg dark:bg-draft-bg-dark", text: "text-on-surface-muted dark:text-on-surface-muted-dark" },
};

export function expenseStatusLabel(status: keyof typeof STYLE): string {
  return STYLE[status].label;
}

export function ExpenseStatusChip({ status, testID }: { status: keyof typeof STYLE; testID?: string }) {
  return (
    <View testID={testID} className={`self-end rounded-full px-2.5 py-0.5 ${STYLE[status].box}`}>
      <Text className={`text-[13px] font-medium ${STYLE[status].text}`}>{STYLE[status].label}</Text>
    </View>
  );
}

/** Android writes the status in its colour in the detail line instead of a chip. */
export function expenseStatusTextClass(status: keyof typeof STYLE): string {
  return STYLE[status].text;
}
