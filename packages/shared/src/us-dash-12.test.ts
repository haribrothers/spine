import { describe, expect, it } from "vitest";
import { attentionSummary, describeAttention, greetingFor, type AttentionItem } from "./schemas/attention.ts";

const money = (minor: string) => `$${(Number(minor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const today = "2026-10-04";
const row = (kind: AttentionItem["kind"], count: number, items: AttentionItem["items"]) => describeAttention({ kind, count, currency: "USD", items }, money, today);

/** US-DASH-12 (D-087, D-088) — how each "Needs your attention" row reads. */
describe("US-DASH-12 · attention rows", () => {
  it("reads like the design for each kind", () => {
    expect(row("invoices_overdue", 1, [{ id: "1", number: "INV-0002", name: "Maple Ridge Developments", amount: "454250", date: "2026-09-22" }])).toEqual({
      title: "1 invoice is overdue",
      detail: "INV-0002 · Maple Ridge Developments · $4,542.50 · 12 days late",
      action: "Send reminder",
    });
    expect(
      row("expenses_awaiting_approval", 2, [
        { id: "1", name: "Sarah Mendes", party: "Travel", amount: "8500" },
        { id: "2", name: "Sarah Mendes", party: "Materials", amount: "19200" },
      ]),
    ).toMatchObject({ title: "2 expenses waiting for your approval", detail: "Sarah Mendes · Travel $85.00 · Materials $192.00", action: "Review" });
    expect(row("quotes_discount_approval", 1, [{ id: "1", number: "QUO-0006", name: "Bluewater Hospitality Group", note: "25% discount", amount: "1280000" }])).toMatchObject({
      title: "QUO-0006 needs discount approval",
      detail: "Bluewater Hospitality Group · 25% discount · $12,800.00",
      action: "Approve",
    });
    expect(row("milestones_to_invoice", 1, [{ id: "1", name: "Mobilisation & site setup", party: "Marina office fit-out", note: "Marcus Webb" }])).toMatchObject({
      title: "Milestone ready to invoice",
      detail: "Mobilisation & site setup · Marina office fit-out · completed by Marcus Webb",
      action: "Raise invoice",
    });
    expect(row("quotes_expiring", 2, [{ id: "1", number: "QUO-0004", name: "Harborview Construction Co.", amount: "51000", date: "2026-10-09" }])).toMatchObject({
      title: "2 quotes expire this week",
      detail: "QUO-0004 · Harborview Construction Co. · $510.00 · Fri 9 Oct · and 1 more",
      action: "Follow up",
    });
    expect(row("vendor_bills_due", 1, [{ id: "1", number: "BILL-2231", name: "Ace Timber Supply", amount: "216000", date: "2026-10-07" }])).toMatchObject({
      title: "Vendor bill due in 3 days",
      detail: "Ace Timber Supply · BILL-2231 · $2,160.00 · due Wed 7 Oct",
      action: "Pay bill",
    });
    expect(row("jobs_over_budget", 1, [{ id: "1", number: "JOB-002", name: "Phase 2 townhomes — foundations", amount: "798000", budget: "770000" }])).toMatchObject({
      title: "1 job is over budget",
      detail: "JOB-002 · Phase 2 townhomes — foundations · $280.00 over a $7,700.00 budget",
    });
  });

  it("greets by time of day and counts what needs you", () => {
    expect([greetingFor(8), greetingFor(13), greetingFor(19)]).toEqual(["Good morning", "Good afternoon", "Good evening"]);
    expect(attentionSummary(6)).toBe("6 things need you today");
    expect(attentionSummary(1)).toBe("1 thing needs you today");
    expect(attentionSummary(0)).toBe("nothing needs you right now");
  });
});
