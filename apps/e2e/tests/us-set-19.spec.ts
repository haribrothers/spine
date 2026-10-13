import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** A valid 2×1 greyscale PNG. */
function tinyPng(): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 0, 255]))), chunk("IEND", Buffer.alloc(0))]);
}

test.describe("US-SET-19", () => {
  test("upload a signature, show it and the amount in words on invoices, then remove it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Sign Owner", email: `e2e-set-19-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByText("Upload a PNG or JPEG of your signature to print it on documents.")).toBeVisible();
    await expect(pane.getByRole("checkbox", { name: "Signature" })).toBeDisabled();

    await pane.getByLabel("Signature image").setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: tinyPng() });
    await expect(pane.getByRole("button", { name: "Replace signature" })).toBeVisible();
    await expect(pane.getByRole("checkbox", { name: "Signature" })).toBeChecked();
    await pane.getByRole("checkbox", { name: "Amount in words" }).check();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    type Saved = { value: { signatureFileId: string | null; invoice: { signature: boolean; amountInWords: boolean } } };
    const saved = (await (await page.request.get(`${API_URL}/org/settings/document_layout`)).json()) as Saved;
    expect(saved.value.signatureFileId).toMatch(/[0-9a-f-]{36}/);
    expect(saved.value.invoice).toMatchObject({ signature: true, amountInWords: true });

    await pane.getByRole("button", { name: "Remove signature" }).click();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => ((await (await page.request.get(`${API_URL}/org/settings/document_layout`)).json()) as Saved).value.signatureFileId).toBeNull();
  });
});
