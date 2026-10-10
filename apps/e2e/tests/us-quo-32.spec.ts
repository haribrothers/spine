import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { accept, contact, linkToken, quote, send, view } from "./quote-seed";

test.describe("US-QUO-32", () => {
  test("Activity tells the quote's story, newest first, with the customer's views grouped and their comment", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-quo-32-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const q = await quote(page, c.id, { title: "Bathroom refit" });
    await send(page, q.id);

    await page.goto(`/quotes/${q.id}`);
    const activity = page.getByTestId("quote-activity");
    await expect(activity.getByTestId("quote-not-viewed")).toHaveText("Not viewed yet");

    const token = await linkToken(page, q.id);
    await view(page, token);
    await view(page, token);
    await accept(page, token, "Please start on the 20th.");
    await page.reload();
    const items = activity.getByRole("listitem");
    await expect(items.first()).toContainText("Accepted online by Ananya Rao");
    await expect(items.first()).toContainText("“Please start on the 20th.”");
    await expect(activity).toContainText("Viewed by the customer 2 times");
    await expect(activity).toContainText("Link copied");
    await expect(activity).toContainText("Sent");
    await expect(activity).toContainText("Priya Raman");
    await expect(activity.getByTestId("quote-not-viewed")).toHaveCount(0);
  });
});
