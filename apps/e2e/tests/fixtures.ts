import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/**
 * The demo-data seed's own Field-role user (`demo-data.service.ts`'s
 * `seedDemoUsers`) — a real, seeded-every-time login, NOT per-org unique.
 * Its membership gets re-pointed to whichever org last called
 * `POST /demo-data/seed` (see that method's own comment on why: Better
 * Auth's `signUpEmail` has no find-or-create, so a repeat seed reuses the
 * existing user row and just moves its membership). Safe here ONLY
 * because `playwright.config.ts` runs with `workers: 1` — two tests
 * never seed concurrently, so "whichever org seeded most recently" is
 * always THIS test's own org by the time it logs in as this user. Do not
 * rely on this identity staying valid across a parallelized run without
 * re-checking this comment.
 */
export const DEMO_FIELD_USER = { email: "marcus.webb.demo@example.com", password: "DemoPassword123!" };

interface SeededOrgFixture {
  seededOrg: { ownerEmail: string; ownerPassword: string };
}

/**
 * `seededOrg` — signs up a brand-new org, skips onboarding, then calls
 * `POST /demo-data/seed` (via `page.request`, sharing that page's own
 * cookie jar) to populate it with real contacts/quotes/invoices/jobs/
 * meetings in one call, per this session's own decision to seed via the
 * API rather than re-driving UI creation flows for every
 * Dashboard/Reports/route-smoke test — those flows already have
 * dedicated coverage in `quote-to-payment.spec.ts`.
 *
 * **Worker-scoped (`scope: "worker"`), not per-test.** Originally
 * per-test, which meant every single test in dashboard.spec.ts/
 * reports.spec.ts/route-smoke.spec.ts (25+ tests) called
 * `POST /demo-data/seed` independently — each seed sends ~7 quotes
 * through the real `quote-send-email` pg-boss queue (PDF render + SMTP
 * send per email), so a full suite run built up a 100+ job backlog that
 * starved OTHER tests' own email-dependent assertions
 * (`quote-to-payment.spec.ts`/`public-quote-page.spec.ts`) well past
 * even a 45s wait — confirmed live via MailDev's own inbox count. One
 * seed per worker (i.e. once per spec file, since `workers: 1` here)
 * fixes the root cause instead of just widening the timeout further.
 * Every test within a describe block now shares the SAME seeded org and
 * its data — fine for this suite's read-only assertions (Dashboard/
 * Reports/route-smoke never mutate the seeded records), but a test that
 * needs to mutate seeded data would need its own fresh org instead.
 *
 * Demo data does NOT include vendor bills/expenses (confirmed by reading
 * `demo-data.service.ts` — no `seedVendorBills`/`seedExpenses` method
 * exists), so Payables/Vendor Bills/Expenses pages stay on their empty
 * state even with this fixture — asserted as correct behavior in
 * `route-smoke.spec.ts`, not a gap in the fixture.
 */
export const test = base.extend<SeededOrgFixture, { seededOrgWorker: SeededOrgFixture["seededOrg"] }>({
  seededOrgWorker: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
      const ownerEmail = `e2e-seeded-${stamp}@example.com`;
      const ownerPassword = "e2e-test-password-1";

      await signUpNewOrg(page, { name: "E2E Seeded Owner", email: ownerEmail, password: ownerPassword });

      const res = await page.request.post(`${API_URL}/demo-data/seed`, {
        headers: { "Idempotency-Key": randomUUID() },
      });
      if (!res.ok()) {
        throw new Error(`POST /demo-data/seed failed: ${res.status()} ${await res.text()}`);
      }

      await context.close();
      await use({ ownerEmail, ownerPassword });
    },
    { scope: "worker" },
  ],
  // Each test still gets its own logged-in `page` (via `signUpNewOrg`'s
  // own session, so a fresh browser context/cookie jar per test — tests
  // shouldn't share a login session even though they share seeded data),
  // but reuses the ALREADY-SEEDED org from the worker-scoped fixture
  // above instead of calling seed again.
  seededOrg: async ({ page, seededOrgWorker }, use) => {
    await logIn(page, { email: seededOrgWorker.ownerEmail, password: seededOrgWorker.ownerPassword });
    await use(seededOrgWorker);
  },
});

export { expect };

/** Logs the given page into an already-existing account — used to switch to the seeded Field user within a seeded org's own test. */
export async function logIn(page: Page, { email, password }: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}
