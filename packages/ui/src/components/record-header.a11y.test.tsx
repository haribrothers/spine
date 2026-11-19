import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Badge } from "./badge";
import { RecordFigures, RecordHeader } from "./record-header";

function asPhone(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }));
}
afterEach(() => vi.unstubAllGlobals());

const header = (
  <RecordHeader
    title="INV-0038"
    badges={<Badge>Overdue</Badge>}
    amount={{ label: "Balance due", value: "$13,255.50", note: "Due Oct 4 · 45 days overdue", tone: "overdue" }}
    meta={<p>Sahyadri Retail</p>}
    actions={<button type="button">Send reminder</button>}
  />
);

describe("RecordHeader a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <>
        {header}
        <RecordFigures>
          <div>Total $24,479.10</div>
          <div>Paid $10,000.00</div>
          <div>Balance due $13,255.50</div>
        </RecordFigures>
      </>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-58: the number is the h1 with its status, then the key amount (on a phone only), then the contact", () => {
    asPhone(true);
    render(header);
    const h1 = screen.getByRole("heading", { level: 1, name: "INV-0038" });
    expect(h1.parentElement!.textContent).toContain("Overdue");
    const amount = document.querySelector("[data-record-amount]")!;
    expect(amount.textContent).toContain("Balance due");
    expect(amount.textContent).toContain("$13,255.50");
    // Overdue reads in the overdue colour.
    expect(amount.querySelector(".text-overdue")?.textContent).toBe("$13,255.50");
    // Amount before the contact.
    const contact = screen.getByText("Sahyadri Retail");
    expect(amount.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send reminder" })).toBeTruthy();
  });

  it("US-OPS-58: from 768px up the amount isn't rendered (it's in the figures)", () => {
    asPhone(false);
    render(header);
    expect(document.querySelector("[data-record-amount]")).toBeNull();
    expect(screen.queryByText("$13,255.50")).toBeNull();
  });

  it("US-OPS-58: figures are two per row on a phone and in one row from 768px up; a last one on its own spans the row", () => {
    render(
      <RecordFigures data-testid="figs">
        <div>Contract</div>
        <div>Billed</div>
        <div>Cost</div>
        <div>Margin</div>
        <div>Complete</div>
      </RecordFigures>,
    );
    const figs = screen.getByTestId("figs");
    expect(figs.className).toContain("grid-cols-2");
    expect(figs.className).toContain("md:grid-cols-5");
    expect(figs.className).toContain("max-md:[&>*:last-child:nth-child(odd)]:col-span-2");
  });
});
