import { describe, expect, it } from "vitest";
import { proposedLines, quoteLinesPrompt, type Candidate } from "./draft-quote-lines.service";

const CATALOGUE: Candidate[] = [
  { ref: "I1", kind: "item", id: "item-tiling", name: "Floor & wall tiling", detail: "per sq ft", description: "Supply and fix vitrified tiles" },
  { ref: "I2", kind: "item", id: "item-demo", name: "Demolition and debris removal", detail: "per job", description: null },
  { ref: "B1", kind: "bundle", id: "bundle-sanitary", name: "Bathroom sanitaryware set", detail: "bundle · WC, basin, shower", description: null },
];
const reply = (lines: unknown[]) => JSON.stringify({ lines });

describe("US-AI-13 · proposed lines from an enquiry (D-172)", () => {
  it("maps refs to the catalogue's own items and bundles, keeps the model's quantities and notes, and work not in the catalogue by name", () => {
    expect(
      proposedLines(
        reply([
          { ref: "I2", name: "Rip out old tiles", description: "Old tiles and fittings", quantity: 1 },
          { ref: "i1", name: "Tiling", quantity: "120" },
          { ref: "B1", name: "WC, basin and shower", quantity: 1 },
          { ref: null, name: "Glass shower screen", description: null, quantity: 1 },
        ]),
        CATALOGUE,
      ),
    ).toEqual([
      { catalogItemId: "item-demo", bundleId: null, name: "Demolition and debris removal", description: "Old tiles and fittings", quantity: 1 },
      { catalogItemId: "item-tiling", bundleId: null, name: "Floor & wall tiling", description: null, quantity: 120 },
      { catalogItemId: null, bundleId: "bundle-sanitary", name: "Bathroom sanitaryware set", description: null, quantity: 1 },
      { catalogItemId: null, bundleId: null, name: "Glass shower screen", description: null, quantity: 1 },
    ]);
  });

  it("an unknown ref is work not in the catalogue; no name and no known ref is dropped; a bad quantity is 1; never a price", () => {
    const lines = proposedLines(
      reply([
        { ref: "I9", name: "Exhaust fan", quantity: 1, price: 3200 },
        { ref: "I7", quantity: 2 },
        { ref: "I1", quantity: -4 },
      ]),
      CATALOGUE,
    );
    expect(lines).toEqual([
      { catalogItemId: null, bundleId: null, name: "Exhaust fan", description: null, quantity: 1 },
      { catalogItemId: "item-tiling", bundleId: null, name: "Floor & wall tiling", description: null, quantity: 1 },
    ]);
    expect(JSON.stringify(lines)).not.toContain("3200");
  });

  it("keeps at most 30 lines, and nothing from a reply that isn't one", () => {
    expect(proposedLines(reply(Array.from({ length: 40 }, (_, i) => ({ ref: null, name: `Job ${i}`, quantity: 1 }))), CATALOGUE)).toHaveLength(30);
    expect(proposedLines("I can't help with that.", CATALOGUE)).toEqual([]);
  });

  it("the prompt has the enquiry and the catalogue by ref, unit and contents — no prices — redacted (D-165)", () => {
    const prompt = quoteLinesPrompt("Redo the bathroom, about 120 sq ft. My GSTIN is 29AAACK0000A1ZK.", CATALOGUE);
    expect(prompt).toContain("about 120 sq ft. My GSTIN is [GSTIN].");
    expect(prompt).toContain("- I1 · Floor & wall tiling · per sq ft · Supply and fix vitrified tiles");
    expect(prompt).toContain("- B1 · Bathroom sanitaryware set · bundle · WC, basin, shower");
    expect(quoteLinesPrompt("Fix the fan", [])).toContain("(nothing in the catalogue yet)");
  });
});
