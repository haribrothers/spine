import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { accept, api, contact, linkToken, quote, send } from "./quote-seed";

test.describe("US-QUO-33", () => {
  test("Related lists every version and the invoice made from the quote, each a link", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-33-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const v1 = await quote(page, c.id, { title: "Bathroom refit" });
    await send(page, v1.id);
    await page.goto(`/quotes/${v1.id}`);
    await expect(page.getByTestId("quote-related")).toHaveCount(0);

    const v2 = await api<{ id: string }>(page, "POST", `/quotes/${v1.id}/revise`);
    await send(page, v2.id);
    await accept(page, await linkToken(page, v2.id));
    const invoice = await api<{ id: string }>(page, "POST", `/invoices/from-quote/${v2.id}`, {});

    await page.goto(`/quotes/${v1.id}`);
    await expect(page.getByTestId("quote-superseded")).toContainText("Superseded by v2");
    const related = page.getByTestId("quote-related");
    await expect(related).toContainText("v1");
    await expect(related).toContainText("this one");
    await related.getByRole("link", { name: /Version 2/ }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${v2.id}`));
    await expect(page.getByTestId("quote-related").getByRole("link", { name: "Draft invoice" })).toHaveAttribute("href", `/invoices/${invoice.id}`);
  });
});
