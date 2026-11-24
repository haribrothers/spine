import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const PASSWORD = "TestPassword123!";

test.describe("US-AUTH-12", () => {
  test("a save after the session ended keeps the draft, and logging in from the dialog returns to it", async ({ page, context }) => {
    const email = `us-auth-12-${randomUUID()}@example.com`;
    await signUpNewOrg(page, { name: "Sam Lee", email, password: PASSWORD });

    await page.goto("/contacts?new=1");
    const name = `Riverstone ${randomUUID().slice(0, 6)}`;
    await page.getByLabel(/^Full name|^Company name/).fill(name);

    // The session ends while the form is open.
    await context.clearCookies();
    let createCalls = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/contacts") createCalls++;
    });
    await page.getByRole("button", { name: "Save contact" }).click();

    const dialog = page.getByTestId("session-expired-dialog");
    await expect(dialog).toContainText("You've been signed out");
    await expect(dialog).toContainText(
      "Your session ended, so this change wasn't saved yet. Log in again to save it — the draft stays open in this tab.",
    );
    await dialog.getByRole("button", { name: "Log in again" }).click();
    await expect(dialog).toContainText(`Log in as ${email}.`);
    await dialog.getByLabel(/^Password/).fill(PASSWORD);
    await dialog.getByRole("button", { name: "Log in" }).click();
    await expect(dialog).toHaveCount(0);

    // Same page, same input, and the save wasn't repeated for us.
    await expect(page).toHaveURL(/\/contacts\?new=1/);
    await expect(page.getByLabel(/^Full name|^Company name/)).toHaveValue(name);
    expect(createCalls).toBe(1);

    await page.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    expect(createCalls).toBe(2);
  });

  test("a background request that gets 401 while only reading goes to /login?next=<this page>", async ({ page, context }) => {
    await page.clock.install();
    await signUpNewOrg(page, { name: "Sam Lee", email: `us-auth-12-read-${randomUUID()}@example.com`, password: PASSWORD });
    await page.goto("/contacts");
    await context.clearCookies();
    // The notification bell refreshes every 20 seconds.
    await page.clock.fastForward(21_000);
    await page.waitForURL(/\/login\?next=%2Fcontacts$/);
  });

  test("logging in follows ?next= only to a page on this site", async ({ page }) => {
    const email = `us-auth-12-next-${randomUUID()}@example.com`;
    await signUpNewOrg(page, { name: "Sam Lee", email, password: PASSWORD });
    await page.goto("about:blank");
    await page.context().clearCookies();

    await page.goto("/login?next=%2F%2Fevil.example%2Fphish");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("about:blank");
    await page.context().clearCookies();
    await page.goto("/login?next=%2Fcontacts");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/contacts");
  });
});
