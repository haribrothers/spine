import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { accept, contact, linkToken, quote, send, view } from "./quote-seed";

/** The focused element: its name, and whether a focus ring (outline or box-shadow ring) shows. */
async function focused(page: Page) {
  return page.evaluate(() => {
    type El = { getAttribute(n: string): string | null; textContent: string | null; tagName: string };
    type Style = { outlineStyle: string; outlineWidth: string; boxShadow: string };
    const g = globalThis as unknown as { document: { activeElement: El | null }; getComputedStyle(e: El): Style };
    const el = g.document.activeElement;
    if (!el || el.tagName === "BODY") return { name: "", ring: true };
    const s = g.getComputedStyle(el);
    const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "");
    return { name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " "), ring };
  });
}

/** Presses Tab until the named control has focus; every control passed on the way must show a focus ring. */
async function tabTo(page: Page, name: string, max = 120) {
  const noRing: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused(page);
    if (!f.ring) noRing.push(f.name);
    if (f.name === name) {
      expect(noRing, `controls without a visible focus ring on the way to "${name}"`).toEqual([]);
      return;
    }
  }
  throw new Error(`"${name}" wasn't reached with Tab`);
}

test.describe("US-OPS-17 · keyboard walkthrough", () => {
  test("quote → invoice → payment is reachable with the keyboard alone, with a visible focus ring at every step", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Lakshmi Hospital");
    const q = await quote(page, c.id, { lines: [{ name: "Site visit", price: "100000" }] });
    await send(page, q.id);
    const token = await linkToken(page, q.id);
    await view(page, token);
    await accept(page, token);

    await page.goto(`/quotes/${q.id}`);
    await expect(page.getByText(/^accepted$/i).first()).toBeVisible();
    await tabTo(page, "Convert to invoice");
    await page.keyboard.press("Enter");
    const convert = page.getByRole("alertdialog", { name: "Convert to an invoice?" });
    await expect(convert).toBeVisible();
    await tabTo(page, "Convert to invoice", 10);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/invoices\/[a-f0-9-]+$/);

    await expect(page.getByRole("button", { name: "Issue invoice" })).toBeVisible();
    await tabTo(page, "Issue invoice");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alertdialog", { name: "Issue this invoice?" })).toBeVisible();
    await tabTo(page, "Issue invoice", 10);
    await page.keyboard.press("Enter");
    await expect(page.getByText("Invoice issued", { exact: true }).first()).toBeVisible();

    await tabTo(page, "Record payment");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Record a payment")).toBeVisible();
    await expect(page.getByTestId("record-payment-summary")).toContainText("nothing becomes credit", { timeout: 10_000 });
    await tabTo(page, "Record payment", 60);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("fig-balance")).toContainText(/Balance due\D*0\.00/, { timeout: 10_000 });
  });
});
