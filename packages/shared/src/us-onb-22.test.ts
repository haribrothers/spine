import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "./document-number";

describe("US-ONB-22 · document numbers read the same in the preview and on documents", () => {
  it("pads to the series' width and adds the year token when there is one", () => {
    expect(formatDocumentNumber({ prefix: "INV", padding: 4 }, 1)).toBe("INV-0001");
    expect(formatDocumentNumber({ prefix: "INV", padding: 4 }, 1042)).toBe("INV-1042");
    expect(formatDocumentNumber({ prefix: "JOB", padding: 3 }, 7)).toBe("JOB-007");
    expect(formatDocumentNumber({ prefix: "QUO", padding: 4, yearToken: "2026" }, 42)).toBe("QUO-2026-0042");
  });
});
