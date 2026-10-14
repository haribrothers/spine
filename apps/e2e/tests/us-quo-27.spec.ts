import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { accept, api, contact, linkToken, quote, send } from "./quote-seed";

test.describe("US-QUO-27", () => {
  test("the cards count open, expiring and won quotes with their value, and the first three filter", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const soon = await quote(page, c.id, { title: "Bathroom refit", validDays: 3, lines: [{ name: "Tiling", price: "100000" }] });
    await send(page, soon.id);
    const later = await quote(page, c.id, { title: "Kitchen", validDays: 30, lines: [{ name: "Cabinets", price: "50000" }] });
    await send(page, later.id);
    // A revised quote counts once.
    await api(page, "POST", `/quotes/${later.id}/revise`);
    const won = await quote(page, c.id, { title: "Garden wall", validDays: 30, lines: [{ name: "Brickwork", price: "200000" }] });
    await send(page, won.id);
    await accept(page, await linkToken(page, won.id));
    await quote(page, c.id, { title: "Draft only" });

    await page.goto("/quotes");
    const stats = page.getByTestId("quote-stats");
    await expect(stats).toContainText("Open1$1,000.00Sent and still valid");
    await expect(stats).toContainText("Expiring in 7 days1");
    await expect(stats).toContainText("Won this month1$2,000.00");
    await expect(stats).toContainText("Win rate100%1 of 1 in the last 90 days");

    const expiring = page.getByRole("button", { name: "Show quotes expiring in 7 days, 1" });
    await expiring.click();
    await expect(expiring).toHaveAttribute("aria-pressed", "true");
    await expect(expiring).toContainText("Showing these · press again to clear");
    await expect(page).toHaveURL(/card=expiring/);
    await expect(page.getByRole("table")).toContainText("Bathroom refit");
    await expect(page.getByRole("table")).not.toContainText("Garden wall");
    await expiring.click();
    await expect(page.getByRole("table")).toContainText("Garden wall");

    await page.getByRole("button", { name: "Show quotes won this month, 1" }).click();
    await expect(page.getByRole("table")).toContainText("Garden wall");
    await expect(page.getByRole("table")).not.toContainText("Bathroom refit");
  });
});
