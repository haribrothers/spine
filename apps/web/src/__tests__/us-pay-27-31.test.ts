import { describe, expect, it } from "vitest";
import { customerView, filterInvoices, howLate, oldestLabel, parseReceivablesState, receivablesQuery, reminderBlocked } from "../app/(app)/receivables/receivables-list-state";
import type { ReceivablesCustomerRow, ReceivablesInvoiceRow } from "../app/(app)/receivables/types";

const row = (over: Partial<ReceivablesInvoiceRow>): ReceivablesInvoiceRow => ({
  id: "i",
  number: "INV-0001",
  contactId: "c1",
  contactName: "Halcyon Tech Parks",
  currency: "INR",
  dueDate: "2026-09-01",
  totalAmount: "100000",
  balanceDue: "100000",
  daysOverdue: 40,
  bucket: "31-60",
  issueDate: "2026-08-01",
  type: "standard",
  paidAmount: "0",
  jobId: null,
  jobName: null,
  lastReminderOn: null,
  remindedToday: false,
  contactHasEmail: true,
  ...over,
});

const customer = (over: Partial<ReceivablesCustomerRow>): ReceivablesCustomerRow => ({
  contactId: "c1",
  name: "Halcyon Tech Parks",
  email: "a@halcyon.example",
  invoiceCount: 2,
  overdueAmount: "100000",
  totalOutstanding: "150000",
  oldestDaysOverdue: 40,
  credit: "20000",
  lastReminderOn: "2026-10-03",
  ...over,
});

describe("US-PAY-27 · see who owes me most, customer by customer", () => {
  const invoices = [
    row({ id: "a", bucket: "31-60", daysOverdue: 40, balanceDue: "100000" }),
    row({ id: "b", bucket: "current", daysOverdue: -5, balanceDue: "50000", number: "INV-0002" }),
    row({ id: "k", contactId: "c2", contactName: "Karthik Subramanian", bucket: "0-30", daysOverdue: 10, balanceDue: "30000", number: "INV-0003" }),
  ];
  const customers = [customer({}), customer({ contactId: "c2", name: "Karthik Subramanian", invoiceCount: 1, overdueAmount: "30000", totalOutstanding: "30000", oldestDaysOverdue: 10, credit: "0", lastReminderOn: null })];

  it("adds each customer up over their invoices, oldest due first under them", () => {
    const [halcyon, karthik] = customerView(customers, invoices, { age: null, q: "" });
    expect(halcyon).toMatchObject({ invoiceCount: 2, overdueAmount: "100000", totalOutstanding: "150000", oldestDaysOverdue: 40, credit: "20000" });
    expect(halcyon!.invoices.map((i) => i.id)).toEqual(["a", "b"]);
    expect(karthik!.invoiceCount).toBe(1);
  });

  it("an age narrows each customer to what's that late; search matches the customer's name", () => {
    expect(customerView(customers, invoices, { age: "current", q: "" }).map((c) => [c.name, c.totalOutstanding])).toEqual([["Halcyon Tech Parks", "50000"]]);
    expect(customerView(customers, invoices, { age: "overdue", q: "" }).map((c) => c.totalOutstanding)).toEqual(["100000", "30000"]);
    expect(customerView(customers, invoices, { age: null, q: "karth" }).map((c) => c.name)).toEqual(["Karthik Subramanian"]);
  });

  it("says how late the oldest is", () => {
    expect(oldestLabel(45)).toBe("45 days late");
    expect(oldestLabel(1)).toBe("1 day late");
    expect(oldestLabel(-3)).toBe("Not due yet");
  });
});

describe("US-PAY-28 · chase a customer without leaving Receivables", () => {
  it("says why a reminder can't go", () => {
    expect(reminderBlocked(row({ remindedToday: true }))).toBe("Already reminded today.");
    expect(reminderBlocked(row({ contactHasEmail: false }))).toBe("The customer has no email address.");
    expect(reminderBlocked(row({}))).toBeNull();
  });
});

describe("US-PAY-29 · filter receivables by age", () => {
  it("keeps the age in the address, and the dashboard's ?overdue=1 opens Overdue", () => {
    expect(parseReceivablesState(new URLSearchParams("age=31-60"))).toMatchObject({ age: "31-60", tab: "customer" });
    expect(parseReceivablesState(new URLSearchParams("overdue=1")).age).toBe("overdue");
    expect(parseReceivablesState(new URLSearchParams("age=whenever")).age).toBeNull();
    expect(filterInvoices([row({ bucket: "current" }), row({ bucket: "61-90" }), row({ bucket: "0-30" })], { age: "overdue", q: "" }).map((r) => r.bucket)).toEqual(["61-90", "0-30"]);
  });
});

describe("US-PAY-30 · read a receivable at a glance", () => {
  it("says how late in words", () => {
    expect(howLate({ dueDate: "2026-09-01", daysOverdue: 12 })).toBe("12 days late");
    expect(howLate({ dueDate: "2026-10-11", daysOverdue: 0 })).toBe("Due today");
    expect(howLate({ dueDate: "2026-10-16", daysOverdue: -5 })).toBe("Due in 5 days");
    expect(howLate({ dueDate: "2026-10-12", daysOverdue: -1 })).toBe("Due in 1 day");
    expect(howLate({ dueDate: null, daysOverdue: -1 })).toBe("No due date");
  });
});

describe("US-PAY-31 · trust what Receivables counts", () => {
  it("keeps the tab, age, search, sort and page in the address, leaving defaults out", () => {
    const state = parseReceivablesState(new URLSearchParams("view=invoices&age=90%2B&q=halcyon&sort=balanceDue.desc&page=2"));
    expect(state).toEqual({ tab: "invoice", age: "90+", q: "halcyon", sort: { key: "balanceDue", direction: "desc" }, page: 2 });
    expect(receivablesQuery(state)).toBe("view=invoices&age=90%2B&q=halcyon&sort=balanceDue.desc&page=2");
    expect(receivablesQuery(parseReceivablesState(new URLSearchParams("")))).toBe("");
  });
});
