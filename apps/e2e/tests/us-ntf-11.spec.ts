import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { clearInbox, signUpNewOrg, waitForEmail } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-NTF-11", () => {
  test("the invitation email uses the layout and names the business from the business profile", async ({ page }) => {
    await signUpNewOrg(page, { name: "Alex Morgan", email: `us-ntf-11-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const business = `Riverstone ${randomUUID().slice(0, 6)}`;
    const saved = await page.request.put(`${API_URL}/org/settings/business_profile`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { value: { name: business, address: "14 Harbour Road" } },
    });
    expect(saved.ok()).toBe(true);

    const invitee = `invitee-${randomUUID()}@example.com`;
    await clearInbox();
    const invited = await page.request.post(`${API_URL}/org/invitations`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { email: invitee, role: "staff" },
    });
    expect(invited.ok()).toBe(true);

    const email = await waitForEmail((e) => e.to.some((t) => t.address === invitee));
    expect(email.subject).toBe(`Alex Morgan invited you to join ${business} on Spine`);
    const html = email.html ?? "";
    expect(html).toContain("border-top:6px solid");
    expect(html).toContain(`Join ${business} on Spine`);
    expect(html).toContain("Accept invitation");
    expect(html).toContain(`${business} · 14 Harbour Road`);
    expect(html).not.toContain("'s Organisation");
  });
});
