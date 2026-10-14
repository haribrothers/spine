import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../app/settings/use-settings-value", () => ({
  useSettingsValue: (key: string, fallback: unknown) => ({
    value: key === "business_profile" ? { name: "Riverstone Builders" } : key === "branding" ? { documentColor: "#0D6E6E", documentFooter: "Licensed builder 4471" } : key === "currency" ? { code: "INR" } : fallback,
    ready: true,
  }),
}));

import { DocumentSample, type DocumentSampleOptions } from "../app/settings/panes/document-sample";

const base: DocumentSampleOptions = {
  type: "invoice",
  title: "Invoice",
  paperSize: "A4",
  columns: { quantity: true, discount: true, hsnSac: false, lineTax: true },
  taxSummary: false,
  amountInWords: false,
  signature: false,
  terms: "",
  notes: "",
  gst: false,
};
const headers = () => screen.getByTestId("document-sample-lines").querySelectorAll("th");

describe("US-SET-17", () => {
  it("draws the document from the options: business, colour, title, columns and footer", () => {
    render(<DocumentSample {...base} />);
    const sample = screen.getByTestId("document-sample");
    expect(sample.textContent).toContain("Riverstone Builders");
    expect(sample.textContent).toContain("Licensed builder 4471");
    expect(screen.getByTestId("document-sample-title").textContent).toBe("Invoice");
    expect([...headers()].map((h) => h.textContent)).toEqual(["Item", "Qty", "Rate", "Disc.", "Tax", "Amount"]);
  });

  it("drops hidden columns and adds HSN/SAC and CGST/SGST for GST", () => {
    render(<DocumentSample {...base} gst columns={{ quantity: false, discount: false, hsnSac: true, lineTax: false }} />);
    expect([...headers()].map((h) => h.textContent)).toEqual(["Item", "HSN/SAC", "Rate", "Amount"]);
    expect(screen.getByTestId("document-sample").textContent).toContain("CGST 9%");
  });
});

describe("US-SET-19", () => {
  it("shows the tax summary, amount in words, signature, terms and notes when chosen", () => {
    render(<DocumentSample {...base} taxSummary amountInWords signature signatureFileId="f1" terms="Pay within 30 days." notes="Thank you." />);
    expect(screen.getByTestId("document-sample-tax-summary")).toBeTruthy();
    expect(screen.getByTestId("document-sample-words").textContent).toMatch(/^Rupees .+ Only$/);
    expect(screen.getByTestId("document-sample-signature").textContent).toContain("Authorised signatory");
    expect(screen.getByRole("img", { name: "Your signature" }).getAttribute("src")).toMatch(/\/files\/f1$/);
    expect(screen.getByTestId("document-sample").textContent).toContain("Pay within 30 days.");
  });

  it("leaves the signature off until one is uploaded", () => {
    render(<DocumentSample {...base} signature signatureFileId={null} />);
    expect(screen.queryByTestId("document-sample-signature")).toBeNull();
  });

  it("shows a receipt's payment, and no lines", () => {
    render(<DocumentSample {...base} type="receipt" title="Receipt" />);
    expect(screen.getByTestId("document-sample").textContent).toContain("Payment received");
    expect(screen.queryByTestId("document-sample-lines")).toBeNull();
  });
});
