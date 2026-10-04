import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** `.env.e2e`'s FILES_DIR is relative to apps/api, where the API runs. */
const FILES_DIR = path.resolve(__dirname, "../../api", process.env.FILES_DIR ?? ".data/files-e2e");

test.describe("US-OPS-28", () => {
  test("an Owner sees the damaged-file warning on the dashboard", async ({ page }) => {
    await signUpNewOrg(page, {
      name: "Integrity Owner",
      email: `e2e-ops28-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`,
      password: "e2e-test-password-1",
    });
    await expect(page.getByTestId("storage-integrity-alert")).toHaveCount(0);

    const upload = await page.request.post(`${API_URL}/files`, {
      headers: { "Idempotency-Key": randomUUID() },
      multipart: { file: { name: "signed-quote.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nsigned quote") } },
    });
    expect(upload.status()).toBe(201);
    const { id, key } = (await upload.json()) as { id: string; key: string };

    // The stored bytes change underneath Spine (disk fault, bad restore).
    await writeFile(path.join(FILES_DIR, key), "corrupted");
    const read = await page.request.get(`${API_URL}/files/${id}`);
    expect(read.status()).toBe(409);
    expect(await read.text()).toContain("This file is damaged. Restore it from your latest backup.");

    await page.goto("/dashboard");
    const alert = page.getByTestId("storage-integrity-alert");
    await expect(alert).toContainText("1 stored file is damaged or missing — restore from your latest backup.");
    await expect(alert).toContainText("File “signed-quote.pdf” (damaged)");
  });
});
