import { t } from "../i18n";

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
  submitted: { label: t("mobileApp.expenseStatus.submitted"), status: "due-soon" },
  approved: { label: t("mobileApp.expenseStatus.approved"), status: "paid" },
  rejected: { label: t("mobileApp.expenseStatus.rejected"), status: "overdue" },
};
