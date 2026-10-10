import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact, linkToken, quote, send, view } from "./quote-seed";

test.describe("US-QUO-29", () => {
  test("rows show when a quote was sent, how long it has left and the customer's views; the row menu acts on it", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const sent = await quote(page, c.id, { title: "Bathroom refit", validDays: 5 });
    await send(page, sent.id);
    const token = await linkToken(page, sent.id);
    await view(page, token);
    await view(page, token);
    await quote(page, c.id, { title: "Kitchen draft" });

    await page.goto("/quotes");
    const sentRow = page.getByRole("row", { name: /Bathroom refit/ });
    await expect(sentRow).toContainText("in 5 days");
    await expect(sentRow.getByTestId("quote-viewed")).toHaveText("Viewed 2×");
    const draftRow = page.getByRole("row", { name: /Kitchen draft/ });
    await expect(draftRow).toContainText("Draft");
    await expect(draftRow).not.toContainText("unsent draft");

    await draftRow.getByRole("button", { name: /^Actions for/ }).click();
    for (const item of ["View", "Edit", "Send", "Preview PDF", "Duplicate", "Delete"]) await expect(page.getByRole("menuitem", { name: item, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await sentRow.getByRole("button", { name: /^Actions for/ }).click();
    await expect(page.getByRole("menuitem", { name: "Revise" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Copy customer link" }).click();
    await expect(page.getByText("Link copied", { exact: true })).toBeVisible();
    expect(await page.evaluate<string>("navigator.clipboard.readText()")).toMatch(/\/quote\/.+/);
  });
});
