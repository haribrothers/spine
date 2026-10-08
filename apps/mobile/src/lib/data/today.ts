export type TodayPeriod = "week" | "month" | "year";

export const PERIODS: { value: TodayPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

/** `GET /mobile/today?period=` (US-MOB-03). Job figures are null while Jobs & field is off. */
export interface TodaySummary {
  period: TodayPeriod;
  today: string;
  from: string;
  to: string;
  milestones: { done: number; total: number; due: number; nextDueDate: string | null; overdue: number; oldestOverdueDate: string | null } | null;
  photos: { taken: number } | null;
  expenses: { total: string; count: number; awaitingApproval: number; currency: string };
}

export const todayKey = (period: TodayPeriod) => `today:${period}`;
export const todayPath = (period: TodayPeriod) => `/mobile/today?period=${period}`;
