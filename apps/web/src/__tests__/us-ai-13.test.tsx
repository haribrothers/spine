import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiQuoteLines, CatalogBundle } from "@spine/shared";

const state = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/api-client", async (original) => ({ ...(await original<typeof import("../lib/api-client")>()), apiClient: { post: state.post } }));

import { isUntouchedBlank, NOT_IN_CATALOGUE_PRICE, proposedLineView, rowsFromAiLines } from "../app/(app)/quotes/quote-ai-lines";
import { QuoteAiLinesPanel } from "../app/(app)/quotes/quote-ai-lines-panel";
import { blankLine } from "../app/(app)/quotes/quote-line-editor";
import type { CatalogItemOption } from "../app/(app)/quotes/types";

const tiling: CatalogItemOption = {
  id: "item-tiling",
  name: "Floor & wall tiling",
  description: "Supply and fix vitrified tiles",
  unit: "sq ft",
  defaultPriceAmount: "95000",
  defaultPriceCurrency: "INR",
  defaultTaxRatePercentage: 0,
  defaultTaxRateId: "gst18-intra",
  defaultTaxGroupId: null,
  interTaxRateId: "igst18",
  interTaxGroupId: null,
  hsnSac: "9954",
  supplyClass: "taxable",
  archivedAt: null,
};
const fan: CatalogItemOption = { ...tiling, id: "item-fan", name: "Exhaust fan", unit: "each", defaultPriceAmount: "4000", defaultPriceCurrency: "USD", hsnSac: null };
const line = (over: object) => ({ type: "item" as const, catalogItemId: null, name: "x", description: null, quantity: 1, unitPriceAmount: "0", discountPercentage: 0, taxRatePercentage: 18, taxRateId: "gst18-intra", taxGroupId: null, isTaxInclusive: false, supplyClass: "taxable" as const, hsnSac: null, id: "l", sortOrder: 0, ...over });
const sanitary: CatalogBundle = {
  id: "bundle-sanitary",
  name: "Bathroom sanitaryware set",
  description: null,
  currency: "INR",
  totalAmount: "4850000",
  createdByUserId: null,
  archivedAt: null,
  createdAt: "2026-10-01",
  lines: [
    line({ id: "l1", name: "Wall-hung WC", unitPriceAmount: "2200000" }),
    line({ id: "l2", name: "Basin with pedestal", quantity: 2, unitPriceAmount: "950000" }),
    line({ id: "l3", type: "heading", name: "Fittings", quantity: 0 }),
  ],
};
const ctx = { catalogItems: [tiling, fan], bundles: [sanitary], currency: "INR", supplyType: "inter" as const, exportUnderLut: false, withSupply: (l: ReturnType<typeof blankLine>) => l };

describe("US-AI-13 · the drafted lines as the quote's own rows (D-172)", () => {
  it("a catalogue item comes in as picking it would: its price, its tax for the place of supply, HSN/SAC; the enquiry's note as description", () => {
    const [row] = rowsFromAiLines([{ catalogItemId: "item-tiling", bundleId: null, name: "Floor & wall tiling", description: "Approx 120 sq ft", quantity: 120 }], ctx);
    expect(row).toMatchObject({ type: "item", catalogItemId: "item-tiling", name: "Floor & wall tiling", description: "Approx 120 sq ft", quantity: 120, unitPriceAmount: 95000n, taxRateId: "igst18", hsnSac: "9954" });
    expect(row!.aiPriceNote).toBeUndefined();
  });

  it("never a price AI didn't get from the catalogue: work not in it, or a price in another currency, says \"Add a price\"", () => {
    const rows = rowsFromAiLines(
      [
        { catalogItemId: null, bundleId: null, name: "Glass shower screen", description: null, quantity: 1 },
        { catalogItemId: "item-fan", bundleId: null, name: "Exhaust fan", description: null, quantity: 1 },
      ],
      ctx,
    );
    expect(rows[0]).toMatchObject({ catalogItemId: null, name: "Glass shower screen", unitPriceAmount: 0n, aiPriceNote: NOT_IN_CATALOGUE_PRICE });
    expect(rows[1]).toMatchObject({ catalogItemId: "item-fan", unitPriceAmount: 0n, aiPriceNote: "Add a price — the catalogue price is in USD." });
  });

  it("a bundle becomes its lines, each item line times the quantity", () => {
    const rows = rowsFromAiLines([{ catalogItemId: null, bundleId: "bundle-sanitary", name: "Bathroom sanitaryware set", description: null, quantity: 2 }], ctx);
    expect(rows.map((r) => [r.type, r.name, r.quantity, r.unitPriceAmount])).toEqual([
      ["item", "Wall-hung WC", 2, 2200000n],
      ["item", "Basin with pedestal", 4, 950000n],
      ["heading", "Fittings", 0, 0n],
    ]);
  });

  it("the panel shows where each line comes from and its price", () => {
    const view = (l: object) => proposedLineView({ catalogItemId: null, bundleId: null, name: "x", description: null, quantity: 1, ...l }, ctx);
    expect(view({ catalogItemId: "item-tiling" })).toEqual({ source: "Catalogue item · per sq ft", priceAmount: 95000n });
    expect(view({ catalogItemId: "item-fan" })).toEqual({ source: "Catalogue item · price in USD", priceAmount: null });
    expect(view({ bundleId: "bundle-sanitary" })).toEqual({ source: "Bundle · Wall-hung WC, Basin with pedestal · 2 lines", priceAmount: 4850000n });
    expect(view({})).toEqual({ source: "Not in your catalogue", priceAmount: null });
  });

  it("a new quote's untouched first row is replaced; one with anything in it isn't", () => {
    expect(isUntouchedBlank(blankLine())).toBe(true);
    expect(isUntouchedBlank({ ...blankLine(), name: "Site visit" })).toBe(false);
    expect(isUntouchedBlank(blankLine("heading"))).toBe(false);
  });
});

describe("US-AI-13 · the Draft lines with AI panel", () => {
  const proposal: AiQuoteLines = {
    candidates: 38,
    lines: [
      { catalogItemId: "item-tiling", bundleId: null, name: "Floor & wall tiling", description: null, quantity: 120 },
      { catalogItemId: null, bundleId: "bundle-sanitary", name: "Bathroom sanitaryware set", description: null, quantity: 1 },
      { catalogItemId: null, bundleId: null, name: "Glass shower screen", description: null, quantity: 1 },
    ],
  };
  const onAdd = vi.fn();
  beforeEach(() => {
    state.post.mockReset().mockResolvedValue(proposal);
    onAdd.mockReset();
  });
  const openPanel = async () => {
    render(<QuoteAiLinesPanel currency="INR" quoteId="q-1" catalogItems={[tiling, fan]} bundles={[sanitary]} pausedUntil={null} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft lines with AI" }));
    const panel = await screen.findByTestId("quote-ai-panel");
    fireEvent.change(within(panel).getByLabelText("Enquiry"), { target: { value: "Redo the bathroom, about 120 sq ft, new WC, basin and a glass screen." } });
    fireEvent.click(within(panel).getByRole("button", { name: "Draft lines" }));
    await within(panel).findByRole("region", { name: "Proposed lines" });
    return panel;
  };

  it("drafts from the enquiry, lists the lines all ticked with their source and price, and adds only the ticked ones", async () => {
    const panel = await openPanel();
    expect(state.post).toHaveBeenCalledWith("/ai/draft-quote-lines", { text: "Redo the bathroom, about 120 sq ft, new WC, basin and a glass screen.", currency: "INR", quoteId: "q-1" }, expect.anything());
    expect(within(panel).getByText("Drafted from the enquiry and 38 catalogue items")).toBeTruthy();
    expect(within(panel).getByText("₹950.00")).toBeTruthy();
    expect(within(panel).getByText("Not in your catalogue")).toBeTruthy();
    expect(within(panel).getByText("Add a price")).toBeTruthy();
    expect(within(panel).getByText("3 of 3 ticked")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Draft again" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("checkbox", { name: "Add Glass shower screen" }));
    expect(within(panel).getByText("2 of 3 ticked")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Add to quote (2)" }));
    expect(onAdd).toHaveBeenCalledWith([proposal.lines[0], proposal.lines[1]]);
    await waitFor(() => expect(screen.queryByTestId("quote-ai-panel")).toBeNull());
  });

  it("closing without adding changes nothing", async () => {
    const panel = await openPanel();
    // The footer's Close (the drawer's ✕ is named Close too).
    fireEvent.click(within(panel).getAllByRole("button", { name: "Close" }).at(-1)!);
    await waitFor(() => expect(screen.queryByTestId("quote-ai-panel")).toBeNull());
    expect(onAdd).not.toHaveBeenCalled();
  });
});
