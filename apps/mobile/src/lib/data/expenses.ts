/** One of my expenses (`GET /expenses?mine=true`; Field only ever gets their own). */
export interface MyExpense {
  id: string;
  number: string | null;
  categoryName: string | null;
  jobId: string | null;
  date: string;
  amount: string;
  currency: string;
  description: string | null;
  status: "submitted" | "approved" | "rejected";
  reviewComment: string | null;
  createdAt: string;
}

export const MY_EXPENSES_KEY = "expenses:mine";
export const MY_EXPENSES_PATH = "/expenses?mine=true";
export const expenseKey = (id: string) => `expense:${id}`;

export const EXPENSE_STATUS: Record<MyExpense["status"], { label: string; status: "paid" | "due-soon" | "overdue" | "draft" }> = {
  submitted: { label: "Submitted", status: "due-soon" },
  approved: { label: "Approved", status: "paid" },
  rejected: { label: "Rejected", status: "overdue" },
};
