import { describe, expect, it } from "vitest";
import { canReviewThis, expenseState, expenseStats, expensesQuery, filterExpenses, nextWaiting, parseExpensesState, readyToBill } from "../app/(app)/expenses/expense-state";
import { expenseActivityText } from "../app/(app)/expenses/expense-activity";
import type { Expense } from "../app/(app)/expenses/types";

const today = new Date(2026, 9, 11);
const ME = "u-me";
const expense = (over: Partial<Expense>): Expense =>
  ({
    id: "e",
    number: null,
    categoryId: "c1",
    categoryName: "Fuel & freight",
    jobId: null,
    jobName: null,
    date: "2026-10-11",
    currency: "INR",
    amount: "485000",
    taxAmount: "0",
    description: "Diesel for the JCB",
    paidBy: "employee",
    status: "submitted",
    submittedByUserId: "u-arjun",
    submittedByName: "Arjun Mehta",
    approvedAt: null,
    isBillable: false,
    billedOnInvoiceLineId: null,
    createdAt: "2026-10-11T08:42:00Z",
    ...over,
  }) as Expense;

describe("US-PUR-42 · see what's waiting and what it's cost at a glance", () => {
  it("says where an expense stands in words; Billed is worked out, never stored", () => {
    expect(expenseState(expense({}))).toBe("wait");
    expect(expenseState(expense({ status: "approved" }))).toBe("appr");
    expect(expenseState(expense({ status: "approved", billedOnInvoiceLineId: "l1" }))).toBe("billed");
    expect(expenseState(expense({ status: "rejected" }))).toBe("rej");
    expect(readyToBill(expense({ status: "approved", isBillable: true }))).toBe(true);
    expect(readyToBill(expense({ status: "approved", isBillable: true, billedOnInvoiceLineId: "l1" }))).toBe(false);
  });

  const list = [
    expense({ id: "w1" }),
    expense({ id: "w2", submittedByUserId: "u-kavya", submittedByName: "Kavya Iyer", amount: "180000", categoryId: "c2", categoryName: "Site meals", description: "Site lunch" }),
    expense({ id: "mine", submittedByUserId: ME, submittedByName: "Priya Raman", amount: "99900" }),
    expense({ id: "a", status: "approved", approvedAt: "2026-10-09T10:00:00Z", number: "EXP-0042", amount: "1240000", jobId: "j1", jobName: "Wing B fit-out" }),
    expense({ id: "bill", status: "approved", approvedAt: "2026-10-07T10:00:00Z", isBillable: true, amount: "1850000" }),
    expense({ id: "old", status: "approved", approvedAt: "2026-09-20T10:00:00Z", amount: "3040000" }),
    expense({ id: "r", status: "rejected", amount: "120000" }),
    expense({ id: "usd", currency: "USD", amount: "5000" }),
  ];

  it("adds up the cards in the business's currency; an approver's Waiting is other people's", () => {
    const stats = expenseStats(list, "INR", today, ME, true);
    expect(stats.waiting).toEqual({ amount: 485000n + 180000n, count: 2 });
    expect(stats.approvedThisMonth).toEqual({ amount: 1240000n + 1850000n, count: 2 });
    expect(stats.toBill).toEqual({ amount: 1850000n, count: 1 });
    expect(stats.rejected.count).toBe(1);
    expect(expenseStats(list, "INR", today, ME, false).waiting.count).toBe(3);
  });

  it("filters by card, state, category, who and search (number, description, category, job or person)", () => {
    const state = parseExpensesState(new URLSearchParams(""));
    const ids = (s: Partial<typeof state>) => filterExpenses(list, { ...state, ...s }, ME, true).map((e) => e.id);
    expect(ids({ card: "wait" })).toEqual(["w1", "w2", "usd"]);
    expect(ids({ card: "bill" })).toEqual(["bill"]);
    expect(ids({ card: "rej" })).toEqual(["r"]);
    expect(ids({ states: ["appr"] })).toEqual(["a", "bill", "old"]);
    expect(ids({ category: "c2" })).toEqual(["w2"]);
    expect(ids({ by: "me" })).toEqual(["mine"]);
    expect(ids({ q: "wing b" })).toEqual(["a"]);
    expect(ids({ q: "kavya" })).toEqual(["w2"]);
    expect(ids({ q: "exp-0042" })).toEqual(["a"]);
  });

  it("keeps the list in the address, and reads the dashboard's older links", () => {
    const state = parseExpensesState(new URLSearchParams("state=wait,bogus&category=c1&by=me&card=bill&q=diesel&sort=amount.desc&page=2"));
    expect(state).toEqual({ states: ["wait"], category: "c1", by: "me", card: "bill", q: "diesel", sort: { key: "amount", direction: "desc" }, page: 2 });
    expect(expensesQuery(state, "j1")).toBe("state=wait&category=c1&by=me&jobId=j1&card=bill&q=diesel&sort=amount.desc&page=2");
    expect(parseExpensesState(new URLSearchParams("status=submitted&mine=true&billable=unbilled"))).toMatchObject({ states: ["wait"], by: "me", card: "bill" });
  });
});

describe("US-PUR-43 · review an expense on its own page", () => {
  it("only an Owner reviews their own expense", () => {
    expect(canReviewThis(expense({ submittedByUserId: ME }), ME, false)).toBe(false);
    expect(canReviewThis(expense({ submittedByUserId: ME }), ME, true)).toBe(true);
    expect(canReviewThis(expense({ status: "approved" }), ME, true)).toBe(false);
  });

  it("Approve and next opens the oldest one still waiting on me", () => {
    const waiting = [expense({ id: "now" }), expense({ id: "newer", date: "2026-10-10" }), expense({ id: "oldest", date: "2026-10-02" }), expense({ id: "mine", date: "2026-09-01", submittedByUserId: ME })];
    expect(nextWaiting(waiting, "now", ME, false)?.id).toBe("oldest");
    expect(nextWaiting([expense({ id: "now" })], "now", ME, false)).toBeNull();
  });

  it("says what each Activity entry was", () => {
    const at = "2026-10-11T08:42:00Z";
    expect(expenseActivityText({ type: "rejected", at, actorName: "Priya", detail: "Use the site van." }, "INR").after).toBe("Use the site van.");
    expect(expenseActivityText({ type: "approved", at, actorName: "Priya", amount: "485000" }, "INR").text).toContain("posted");
    expect(expenseActivityText({ type: "billed", at, actorName: "Priya", detail: "INV-0012", linkId: "i1" }, "INR").link).toEqual({ label: "INV-0012", href: "/invoices/i1" });
    expect(expenseActivityText({ type: "edited", at, actorName: "Arjun", detail: "receipt" }, "INR").text).toBe("Edited · receipt");
  });
});
