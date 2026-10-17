import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentSuggestion } from "@spine/shared";
import { planBillFill, type BillField } from "../app/(app)/vendor-bills/bill-ai-fill";
import { BillAiReader } from "../app/(app)/vendor-bills/bill-ai-reader";
import { blankLine } from "../app/(app)/vendor-bills/vendor-bill-line-editor";

const apex: DocumentSuggestion = {
  vendor: { contactId: "c-apex", name: "Apex Building Materials Pvt Ltd" },
  number: "ABM-20611",
  date: "2026-10-14",
  dueDate: "2026-11-13",
  dueNote: "Payment due within 30 days",
  currency: "INR",
  placeOfSupply: "29",
  lines: [
    { name: "OPC 53 cement — 50 kg bags", description: "Delivered to Wing B", hsnSac: "2523", quantity: 400, unitPriceAmount: "41000", taxPercent: 18, isTaxInclusive: false, taxRateId: null, taxGroupId: "gst18", catalogItemId: "item-cement", accountId: "acc-5000", accountFrom: "last_bill" },
    { name: "TMT steel bars Fe 500D", description: null, hsnSac: "7214", quantity: 1200, unitPriceAmount: "6850", taxPercent: 5, isTaxInclusive: false, taxRateId: null, taxGroupId: null, catalogItemId: null, accountId: null, accountFrom: null },
  ],
  documentTotal: "27990000",
  computedTotal: "27983000",
  readMs: 4200,
  readAsImages: false,
};

const empty = { contactId: "", billNumber: "", currency: "USD", date: new Date("2026-10-17"), dueDate: undefined, placeOfSupply: null, lines: [blankLine()] };

describe("US-AI-08", () => {
  it("fills the header and the lines on a new bill — today's date and the default currency aren't entries", () => {
    const plan = planBillFill(empty, new Set(), apex);
    expect(plan.header).toEqual({ contactId: "c-apex", billNumber: "ABM-20611", currency: "INR", date: new Date("2026-10-14"), dueDate: new Date("2026-11-13"), placeOfSupply: "29" });
    expect(plan.filled).toEqual(["vendor", "billNumber", "currency", "date", "dueDate", "placeOfSupply"]);
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines![0]).toMatchObject({ catalogItemId: "item-cement", name: "OPC 53 cement — 50 kg bags", quantity: 400, unitPriceAmount: 41000n, taxGroupId: "gst18", accountId: "acc-5000", supplyClass: "taxable", hsnSac: "2523" });
    expect(plan.lines![1]).toMatchObject({ taxGroupId: null, accountId: null, supplyClass: "zero_rated" });
    expect(plan.replaceCount).toBe(0);
    expect(plan.newVendor).toBeNull();
  });

  it("on a draft bill fills only empty fields and offers \"Replace my entries (<n>)\" for the rest", () => {
    const entered = new Set<BillField>(["vendor", "billNumber", "currency", "date"]);
    const draft = { ...empty, contactId: "c-apex", billNumber: "ABM-2061", currency: "INR", date: new Date("2026-10-14"), lines: [{ ...blankLine(), name: "Cement", unitPriceAmount: 40000n }] };
    const plan = planBillFill(draft, entered, apex);
    expect(plan.header).toEqual({ dueDate: new Date("2026-11-13"), placeOfSupply: "29" });
    expect(plan.kept).toEqual({ billNumber: "ABM-20611" });
    expect(plan.lines).toBeNull();
    expect(plan.keptLines).toHaveLength(2);
    // The bill number and the one line the person typed.
    expect(plan.replaceCount).toBe(2);
  });

  it("offers a vendor it couldn't match, without choosing one", () => {
    const plan = planBillFill(empty, new Set(), { ...apex, vendor: { contactId: null, name: "Shree Ganesh Hardware" } });
    expect(plan.header.contactId).toBeUndefined();
    expect(plan.newVendor).toBe("Shree Ganesh Hardware");
    expect(planBillFill({ ...empty, contactId: "c-mine" }, new Set<BillField>(["vendor"]), { ...apex, vendor: { contactId: null, name: "Shree Ganesh Hardware" } }).newVendor).toBeNull();
  });

  it("\"Read from document\" chooses a PDF or photo, and says what was read and how long it took", () => {
    const onChoose = vi.fn();
    const { rerender } = render(<BillAiReader state={{ status: "idle" }} pausedUntil={null} attachedNote="attached to this bill" onChoose={onChoose} onCancel={vi.fn()} onRetry={vi.fn()} />);
    const input = screen.getByLabelText("Choose the vendor's bill to read") as HTMLInputElement;
    expect(input.accept).toContain("application/pdf");
    const file = new File(["%PDF-1.4"], "ABM-20611.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onChoose).toHaveBeenCalledWith(file);

    rerender(<BillAiReader state={{ status: "done", fileName: "ABM-20611.pdf", readMs: 4200, asImage: false }} pausedUntil={null} attachedNote="attached to this bill" onChoose={onChoose} onCancel={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByTestId("bill-ai-reader").textContent).toContain("ABM-20611.pdfRead by AI in 4 seconds · attached to this bill · check what it filled in before you save");
    expect(screen.getByRole("button", { name: "Read another document" })).toBeTruthy();
  });

  it("an image the model can't read says so, and the strip stays to choose another file", () => {
    render(
      <BillAiReader
        state={{ status: "failed", fileName: "bill.jpg", message: "Your AI model can't read images. Choose a model that can, or enter the bill by hand.", canRetry: false }}
        pausedUntil={null}
        attachedNote="attached to this bill"
        onChoose={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ai-unavailable").textContent).toContain("Your AI model can't read images.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Read from document" })).toBeTruthy();
  });

  it("while the budget is used up, the button shows disabled with why", () => {
    render(<BillAiReader state={{ status: "idle" }} pausedUntil="2026-11-01" attachedNote="attached to this bill" onChoose={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Read from document" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("bill-ai-reader").textContent).toContain("AI is paused until 1 November");
  });
});
