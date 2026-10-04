import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const HEADLINE = "This invitation can't be used";
const BODY = "It may have expired, been cancelled, or already been accepted. Ask whoever invited you to send a new one.";

test.describe("US-AUTH-11", () => {
  test("signed out, an unknown invitation says it can't be used; 'Log in instead' goes to /login", async ({ page }) => {
    await page.goto(`/accept-invite/${randomUUID()}`);
    const card = page.getByTestId("invite-unusable");
    await expect(card).toContainText(HEADLINE);
    await expect(card).toContainText(BODY);
    await card.getByRole("link", { name: "Log in instead" }).click();
    await page.waitForURL("**/login");
  });

  test("signed in, a cancelled invitation shows the same page; a pending one shows the normal page", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-auth-11-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const create = async () => {
      const res = await page.request.post(`${API_URL}/org/invitations`, {
        headers: { "Idempotency-Key": randomUUID() },
        data: { email: `invitee-${randomUUID()}@example.com`, role: "staff" },
      });
      expect(res.ok()).toBe(true);
      return ((await res.json()) as { id: string }).id;
    };

    const pendingId = await create();
    const cancelledId = await create();
    const cancelled = await page.request.delete(`${API_URL}/org/invitations/${cancelledId}`, { headers: { "Idempotency-Key": randomUUID() } });
    expect(cancelled.ok()).toBe(true);

    await page.goto(`/accept-invite/${cancelledId}`);
    await expect(page.getByTestId("invite-unusable")).toContainText(HEADLINE);

    await page.goto(`/accept-invite/${pendingId}`);
    await expect(page.getByText("You've been invited")).toBeVisible();
    await expect(page.getByTestId("invite-unusable")).toHaveCount(0);
  });
});
