import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const APP_URL = process.env.APP_URL ?? "http://localhost:3110";
import { api } from "./quote-seed";

/** A cross-origin answer the browser hands to the app (the API is on another port). */
const cors = { "Access-Control-Allow-Origin": APP_URL, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "X-Request-Id" };

test.describe("US-OPS-13 · recover from an unexpected error", () => {
  test("a page that fails on the server says saved work is safe, gives the request id, and recovers", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-13-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const contact = await api<{ id: string }>(page, "POST", "/contacts", { type: "customer", name: "Lakshmi Hospital" });

    // The API fails loading this contact, as a server error would.
    await page.route(`**/contacts/${contact.id}`, (route) =>
      route.request().resourceType() === "fetch"
        ? route.fulfill({ status: 500, headers: { ...cors, "X-Request-Id": "req-e2e-7f3a9c" }, json: { message: "Internal server error" } })
        : route.fallback(),
    );
    await page.goto(`/contacts/${contact.id}`);
    await expect(page.getByRole("heading", { name: "Something went wrong on our side" })).toBeVisible();
    await expect(page.getByTestId("server-error")).toContainText("Nothing you entered was lost — anything you saved is still saved.");
    await expect(page.getByTestId("error-reference")).toHaveText("Error reference: req-e2e-7f3a9c");

    // Fixed: Try again reloads the page, which now loads.
    await page.unroute(`**/contacts/${contact.id}`);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Lakshmi Hospital").first()).toBeVisible();
    await expect(page.getByTestId("server-error")).toHaveCount(0);

    await page.route(`**/contacts/${contact.id}`, (route) =>
      route.request().resourceType() === "fetch" ? route.fulfill({ status: 503, headers: cors, json: { message: "Unavailable" } }) : route.fallback(),
    );
    await page.reload();
    await page.getByRole("link", { name: "Go to dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
