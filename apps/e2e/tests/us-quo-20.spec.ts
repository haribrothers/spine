import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { axeViolations } from "./axe";
import { sendQuoteAndGetPublicLink, signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test.describe("US-QUO-20", () => {
  test("a quote accepted through the link says it was accepted online, with the date", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-quo-20-online-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const link = await sendQuoteAndGetPublicLink(page, { contactName: "Alan Brooks", contactEmail: `alan-${randomUUID()}@example.com` });
    const quoteUrl = page.url();
    const customer = await page.context().newPage();
    await customer.goto(link);
    await customer.getByRole("button", { name: "Accept quote" }).click();
    await expect(customer.getByText(/You accepted this quote/)).toBeVisible({ timeout: 10_000 });
    await customer.close();

    await page.goto(quoteUrl);
    await expect(page.getByTestId("quote-acceptance")).toContainText(/Accepted online by the customer on \w{3} \d{1,2}, \d{4}/);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "View history" }).click();
    await expect(page.getByText("The customer accepted this quote online")).toBeVisible();
  });

  test("a quote accepted on site shows the signer, the time, who witnessed it and the signature", async ({ page }) => {
    await signUpNewOrg(page, { name: "Marcus Webb", email: `us-quo-20-site-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await sendQuoteAndGetPublicLink(page, { contactName: "Harborview Construction Co.", contactEmail: `harborview-${randomUUID()}@example.com` });
    const quoteUrl = page.url();
    const quoteId = quoteUrl.split("/").pop()!;

    const upload = await page.request.post(`${API_URL}/files`, { multipart: { file: { name: "signature.png", mimeType: "image/png", buffer: PNG } }, headers: { "Idempotency-Key": randomUUID() } });
    const { id: signatureFileId } = (await upload.json()) as { id: string };
    const accepted = await page.request.post(`${API_URL}/quotes/${quoteId}/accept-in-person`, { data: { signatureFileId, signerName: "Alan Reyes" }, headers: { "Idempotency-Key": randomUUID() } });
    expect(accepted.status()).toBeLessThan(300);

    await page.goto(quoteUrl);
    const panel = page.getByTestId("quote-acceptance");
    await expect(panel).toContainText("Accepted on site");
    await expect(panel).toContainText(/Signed by Alan Reyes on \w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2}\s?[AP]M, witnessed by Marcus Webb/);
    await expect(panel.getByRole("img", { name: "Signature of Alan Reyes" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "View signature full size" })).toHaveAttribute("href", new RegExp(`/files/${signatureFileId}$`));
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "View history" }).click();
    await expect(page.getByText("Marcus Webb recorded the customer's acceptance of this quote on site, signed by Alan Reyes")).toBeVisible();
  });
});
