import { describe, expect, it } from "vitest";
import { describeAttention, type AttentionItem } from "@spine/shared";
import { attentionHref } from "../app/(app)/dashboard/attention-card";

describe("US-DASH-30 · see failed emails in Needs your attention", () => {
  const item: AttentionItem = { kind: "emails_failed", count: 2, currency: "INR", items: [{ id: "e1", party: "Reminder", number: "INV-0039", name: "accounts@halcyontech.example" }, { id: "e2", party: "Invoice", name: "a@b.example" }] };

  it("reads “2 emails failed”, naming the first, with Review", () => {
    expect(describeAttention(item, (m) => m, "2026-10-11")).toEqual({ title: "2 emails failed", detail: "Reminder INV-0039 to accounts@halcyontech.example · and 1 more", action: "Review" });
    expect(describeAttention({ ...item, count: 1, items: [{ id: "e1", party: "Daily digest", name: "priya@example.com" }] }, (m) => m, "2026-10-11").title).toBe("1 email failed");
  });

  it("Review opens the email log filtered to Failed", () => {
    expect(attentionHref(item)).toBe("/emails?card=failed");
  });
});
