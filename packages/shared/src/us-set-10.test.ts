import { describe, expect, it } from "vitest";
import { brandingSchema, contrastOnWhite, formatContrast, resolveDocumentBranding, DEFAULT_DOCUMENT_COLOR } from "./schemas/branding.ts";

/** US-SET-10 — the document colour must be readable on white; the footer is short. */
describe("US-SET-10 · document colour and footer", () => {
  it("shows Spine Blue as 6.0:1 on white", () => {
    expect(formatContrast(contrastOnWhite("#2954E5"))).toBe("6.0:1");
  });

  it("accepts a colour at 4.5:1 or more", () => {
    expect(brandingSchema.safeParse({ documentColor: "#767676" }).success).toBe(true);
    expect(brandingSchema.safeParse({ documentColor: "#0d6e6e" }).success).toBe(true);
  });

  it("refuses a colour below 4.5:1 and says how readable it is", () => {
    const result = brandingSchema.safeParse({ documentColor: "#7A7A7A" });
    expect(result.error?.issues[0]?.message).toBe("Too light to read on white (4.2:1). Pick a darker colour — documents need at least 4.5:1.");
  });

  it("refuses anything that isn't #RRGGBB", () => {
    for (const value of ["teal", "#FFF", "2954E5", "#2954E5FF"]) {
      expect(brandingSchema.safeParse({ documentColor: value }).error?.issues[0]?.message, value).toBe("Enter a colour as # and six hex digits, e.g. #2954E5.");
    }
  });

  it("allows a footer up to 300 characters", () => {
    expect(brandingSchema.safeParse({ documentFooter: "x".repeat(300) }).success).toBe(true);
    expect(brandingSchema.safeParse({ documentFooter: "x".repeat(301) }).error?.issues[0]?.message).toBe("Keep the footer under 300 characters.");
  });

  it("documents print the saved colour and trimmed footer, falling back to Spine Blue and no footer", () => {
    expect(resolveDocumentBranding({ documentColor: "#0d6e6e", documentFooter: "  Thanks  " })).toEqual({ color: "#0D6E6E", footer: "Thanks" });
    expect(resolveDocumentBranding(undefined)).toEqual({ color: DEFAULT_DOCUMENT_COLOR });
    expect(resolveDocumentBranding({ documentColor: "#8FB3FF", documentFooter: "   " })).toEqual({ color: DEFAULT_DOCUMENT_COLOR });
  });
});
