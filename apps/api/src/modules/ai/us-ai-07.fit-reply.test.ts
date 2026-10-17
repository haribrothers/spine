import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fitAiReply, parseAiJson } from "./fit-reply";

const header = { billNumber: z.string().trim().min(1).max(60), billDate: z.iso.date(), currency: z.string().regex(/^[A-Z]{3}$/) };
const line = { name: z.string().trim().min(1).max(200), quantity: z.number().positive(), rate: z.string().regex(/^\d+(\.\d{1,2})?$/) };

/** US-AI-07 (R-23) — a reply Spine can't use fills nothing it can't check. */
describe("US-AI-07 · fitting an AI reply", () => {
  it("leaves a field that fails its check empty and fills the rest", () => {
    const reply = JSON.stringify({ billNumber: "RTE-3318", billDate: "16 Oct 2026", currency: "INR" });
    expect(fitAiReply(reply, header)).toEqual({ value: { billNumber: "RTE-3318", currency: "INR" }, dropped: ["billDate"] });
  });

  it("checks each row of a list on its own, keeping the good fields of a row", () => {
    const reply = { billNumber: "RTE-3318", lines: [{ name: "Excavator hire", quantity: 2, rate: "4500.00" }, { name: "Diesel", quantity: -1, rate: "about 90" }, "ignore me", {}] };
    expect(fitAiReply(reply, header, { lines: line })).toEqual({
      value: { billNumber: "RTE-3318", lines: [{ name: "Excavator hire", quantity: 2, rate: "4500.00" }, { name: "Diesel" }] },
      dropped: ["lines.1.quantity", "lines.1.rate", "lines.2"],
    });
  });

  it("drops fields the shape doesn't name, so a document can't add its own", () => {
    expect(fitAiReply({ billNumber: "A-1", status: "paid", recordNow: true }, header).value).toEqual({ billNumber: "A-1" });
  });

  it("fills nothing from a reply that isn't JSON", () => {
    expect(fitAiReply("Sorry, I can't read this document.", header)).toEqual({ value: {}, dropped: ["*"] });
    expect(fitAiReply("[1, 2]", header)).toEqual({ value: {}, dropped: ["*"] });
  });

  it("reads JSON in a fence or with words around it", () => {
    expect(parseAiJson('Here it is:\n```json\n{"billNumber": "A-1"}\n```')).toEqual({ billNumber: "A-1" });
    expect(parseAiJson('The bill: {"billNumber": "A-2"} — done.')).toEqual({ billNumber: "A-2" });
    expect(parseAiJson("{not json}")).toBeNull();
  });
});
