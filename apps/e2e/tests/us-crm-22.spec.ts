import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const LIST = "**/contacts?includeArchived=true";

async function addContact(page: Page, name: string) {
  expect((await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data: { type: "customer", name } })).ok()).toBe(true);
}

test.describe("US-CRM-22", () => {
  test("Refresh reloads the list in place, shows a contact someone else added and says when it was updated", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await page.goto("/contacts");
    await page.getByRole("radio", { name: "List view" }).click();
    await expect(page.getByTestId("contacts-updated")).toHaveText("Updated just now");
    const firstRow = page.getByRole("listitem").first();
    await expect(firstRow).toBeVisible();

    const added = `Aaron Added Elsewhere ${randomUUID().slice(0, 6)}`;
    await addContact(page, added);
    await expect(page.getByText(added)).toHaveCount(0);

    // While it loads, the list stays and the button can't be pressed twice.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(LIST, async (route) => {
      await held;
      await route.continue().catch(() => {});
    });
    const refresh = page.getByRole("button", { name: "Refresh list" });
    await refresh.click();
    await expect(page.getByTestId("contacts-updated")).toHaveText("Updating…");
    await expect(refresh).toBeDisabled();
    await expect(firstRow).toBeVisible();
    release();

    await expect(page.getByText(added)).toBeVisible();
    await page.unroute(LIST);
    await expect(page.getByRole("status").filter({ hasText: "Contacts updated" })).toBeAttached();
    await expect(page.getByTestId("contacts-updated")).toHaveText("Updated just now");
  });

  test("a failed refresh keeps the list and offers Try again; coming back to the tab after 30 s refreshes", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await page.goto("/contacts");
    await page.getByRole("radio", { name: "List view" }).click();
    await expect(page.getByRole("listitem").first()).toBeVisible();

    await page.route(LIST, (route) => route.fulfill({ status: 500, json: { message: "Server error" } }));
    await page.getByRole("button", { name: "Refresh list" }).click();
    const failed = page.getByTestId("contacts-refresh-failed");
    await expect(failed).toContainText("Couldn't refresh the list. Check your connection and try again.");
    await expect(page.getByRole("listitem").first()).toBeVisible();
    await page.unroute(LIST);
    await failed.getByRole("button", { name: "Try again" }).click();
    await expect(failed).toHaveCount(0);

    // Away for over 30 seconds, then back on the tab.
    const back = `Aaron Back On The Tab ${randomUUID().slice(0, 6)}`;
    await addContact(page, back);
    await page.evaluate(() => {
      const doc = (globalThis as unknown as { document: { dispatchEvent(e: unknown): void } }).document;
      Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "hidden" });
      doc.dispatchEvent(new Event("visibilitychange"));
      const realNow = Date.now;
      Date.now = () => realNow() + 31_000;
      Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "visible" });
      doc.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByText(back)).toBeVisible();
  });
});
