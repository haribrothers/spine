import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const LONG_NAME = "H2Z Facades and Interiors Factory Private Limited (Whitefield Unit)";
const LONG_EMAIL = "accounts.payable.department@h2zfacadesandinteriorsfactory.co.in";

/** Adds the contact once per seeded org (the org is shared by every test in this file). */
async function ensureContact(page: Page, data: { type: string; name: string; email?: string; phone?: string }) {
  const existing = (await (await page.request.get(`${API_URL}/contacts?includeArchived=true`)).json()) as { name: string }[];
  if (existing.some((c) => c.name === data.name)) return;
  expect((await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data })).ok()).toBe(true);
}

const addLongContact = (page: Page) => ensureContact(page, { type: "both", name: LONG_NAME, email: LONG_EMAIL, phone: "+91 98450 12345" });

async function inside(inner: Locator, outer: Locator) {
  const [a, b] = await Promise.all([inner.boundingBox(), outer.boundingBox()]);
  expect(a!.x).toBeGreaterThanOrEqual(b!.x - 0.5);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + b!.width + 0.5);
}

test.describe("US-CRM-21", () => {
  test("in the Card and List views a long name wraps to two lines and a long email is cut short, all inside the card", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await addLongContact(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/contacts");
    await page.getByRole("radio", { name: "Card view" }).click();

    const card = page.getByTestId("contact-card").filter({ hasText: "H2Z Facades" });
    const name = card.getByTitle(LONG_NAME);
    await expect(name).toBeVisible();
    await inside(name, card);
    const lines = await name.evaluate((el) => {
      const s = (globalThis as unknown as { getComputedStyle(e: unknown): { lineHeight: string } }).getComputedStyle(el);
      return Math.round((el as unknown as { clientHeight: number }).clientHeight / Number.parseFloat(s.lineHeight));
    });
    expect(lines).toBeLessThanOrEqual(2);
    const email = card.getByTitle(LONG_EMAIL);
    await inside(email, card);
    expect(await email.evaluate((el) => (el as unknown as { scrollWidth: number; clientWidth: number }).scrollWidth > (el as unknown as { clientWidth: number }).clientWidth)).toBe(true);

    // The "⋯" menu never sits on top of the name.
    const [menu, nameBox] = await Promise.all([card.getByRole("button").first().boundingBox(), name.boundingBox()]);
    expect(nameBox!.x + nameBox!.width <= menu!.x || nameBox!.y >= menu!.y + menu!.height).toBe(true);

    await page.getByRole("radio", { name: "List view" }).click();
    const row = page.getByRole("listitem").filter({ hasText: "H2Z Facades" });
    await inside(row.getByTitle(LONG_NAME), row);
  });

  test("in the Table view at 1280 px every column, Status included, fits without scrolling sideways", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await addLongContact(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/contacts");
    await page.getByRole("radio", { name: "Table view" }).click();

    const status = page.getByRole("columnheader", { name: "Status" });
    await expect(status).toBeInViewport({ ratio: 1 });
    const scroller = page.locator("table").locator("xpath=..");
    expect(await scroller.evaluate((el) => (el as unknown as { scrollWidth: number; clientWidth: number }).scrollWidth <= (el as unknown as { clientWidth: number }).clientWidth + 1)).toBe(true);
    await expect(page.getByRole("cell").getByTitle(LONG_EMAIL)).toBeVisible();
  });
});
