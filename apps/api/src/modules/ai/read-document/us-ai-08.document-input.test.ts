import { describe, expect, it } from "vitest";
import { billPhoto, scannedBillPdf, textBillPdf } from "../../../test-utils/bill-documents";
import { documentInput } from "./document-input";

/** US-AI-08 (D-170) — what's sent: a PDF's text, or images of a scan or a photo. */
describe("US-AI-08 · preparing a document", () => {
  it("sends a PDF with a text layer as its text", async () => {
    const input = await documentInput(textBillPdf(["Apex Building Materials Pvt Ltd", "Tax invoice ABM-20611", "OPC 53 cement 400 x 410.00"]), "application/pdf");
    expect(input.kind).toBe("text");
    expect(input.kind === "text" && input.text).toContain("Tax invoice ABM-20611");
  });

  it("sends a scanned PDF's page as an image", async () => {
    const input = await documentInput(scannedBillPdf(), "application/pdf");
    expect(input.kind).toBe("images");
    if (input.kind !== "images") return;
    expect(input.images).toHaveLength(1);
    expect(input.images[0]!.mimeType).toBe("image/png");
    expect(Buffer.from(input.images[0]!.base64, "base64").subarray(1, 4).toString()).toBe("PNG");
  });

  it("sends a photo as it is", async () => {
    const photo = billPhoto();
    expect(await documentInput(photo, "image/png")).toEqual({ kind: "images", images: [{ mimeType: "image/png", base64: photo.toString("base64") }] });
  });

  it("refuses a file AI can't read, saying which it can", async () => {
    await expect(documentInput(Buffer.from("x"), "image/heic")).rejects.toThrow("AI can read PDFs and JPEG, PNG or WebP photos.");
  });
});
