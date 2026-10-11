import { describe, expect, it } from "vitest";
import { spreadOldestFirst } from "../components/record-payment-dialog";

describe("US-PAY-23 · record a payment by ticking what it pays", () => {
  const invoices = [
    { id: "a", number: "INV-0035", balance: 18500000n, dueDate: "2026-09-28", type: "standard" },
    { id: "b", number: "INV-0039", balance: 17000000n, dueDate: "2026-10-05", type: "standard" },
    { id: "c", number: "INV-0043", balance: 23600000n, dueDate: "2026-10-25", type: "standard" },
  ];

  it("spreads a typed amount oldest first, each line up to its balance", () => {
    expect([...spreadOldestFirst(invoices, 40000000n)]).toEqual([
      ["a", 18500000n],
      ["b", 17000000n],
      ["c", 4500000n],
    ]);
    expect([...spreadOldestFirst(invoices, 10000000n)]).toEqual([["a", 10000000n]]);
    expect([...spreadOldestFirst(invoices, 0n)]).toEqual([]);
  });
});
