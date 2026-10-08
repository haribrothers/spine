import type { FieldJob } from "../data/jobs";
import type { MyExpense } from "../data/expenses";

/** Lower-case, accents off ("Café" matches "cafe"), so matching ignores both (US-MOB-23). */
export function normalise(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** `text` split into plain and matching parts, for highlighting. Accent-insensitive; keeps the original characters. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = normalise(query.trim());
  if (!q) return [{ text, match: false }];
  // NFD can change length (é → e + ◌́), so compare character by character.
  const chars = [...text];
  const folded = chars.map((c) => normalise(c));
  const parts: { text: string; match: boolean }[] = [];
  let i = 0;
  let plain = "";
  while (i < chars.length) {
    let j = i;
    let built = "";
    while (j < chars.length && built.length < q.length) built += folded[j++];
    if (built === q) {
      if (plain) parts.push({ text: plain, match: false });
      plain = "";
      parts.push({ text: chars.slice(i, j).join(""), match: true });
      i = j;
    } else {
      plain += chars[i++];
    }
  }
  if (plain) parts.push({ text: plain, match: false });
  return parts;
}

export interface ExpenseHit {
  expense: MyExpense;
  jobName: string | null;
  /** True while it's still in the phone's outbox (Group 3). */
  waiting: boolean;
}

export interface SearchResults {
  jobs: FieldJob[];
  expenses: ExpenseHit[];
}

/**
 * US-MOB-23 — searches what's on the phone: my assigned jobs by name,
 * customer, job number or site address; my own expenses (sent or still
 * waiting) by category, description or job. Jobs are left out while Jobs
 * & field is off (D-198).
 */
export function searchCache(input: { query: string; jobs: FieldJob[]; expenses: MyExpense[]; waitingExpenses?: MyExpense[]; jobsOn: boolean }): SearchResults {
  const q = normalise(input.query.trim());
  if (!q) return { jobs: [], expenses: [] };
  const has = (value: string | null | undefined) => Boolean(value) && normalise(value!).includes(q);
  const jobName = new Map(input.jobs.map((job) => [job.id, job.name]));

  const jobs = input.jobsOn ? input.jobs.filter((job) => has(job.name) || has(job.contactName) || has(job.number) || has(job.siteAddress)) : [];
  const hits: ExpenseHit[] = [
    ...(input.waitingExpenses ?? []).map((expense) => ({ expense, waiting: true })),
    ...input.expenses.map((expense) => ({ expense, waiting: false })),
  ].map(({ expense, waiting }) => ({ expense, waiting, jobName: input.jobsOn && expense.jobId ? (jobName.get(expense.jobId) ?? null) : null }));
  const expenses = hits.filter(({ expense, jobName: name }) => has(expense.categoryName) || has(expense.description) || has(name));
  return { jobs, expenses };
}
