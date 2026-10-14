import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

const MAILDEV_URL = process.env.MAILDEV_URL ?? "http://localhost:1080";

export interface SentEmail {
  id: string;
  to: { address: string }[];
  subject: string;
  html?: string;
  text?: string;
  time: string;
}

/** Emails already in MailDev when this worker last called `clearInbox` — `waitForEmail` ignores them. */
const seenEmailIds = new Set<string>();

/**
 * "Only emails from now on" — call before an action that sends one. It
 * doesn't empty MailDev; it remembers what's there, and `waitForEmail`
 * ignores those (D-241: nothing a test does removes another's mail, and no
 * request races a delete). global-setup empties the inbox once per run.
 */
export async function clearInbox(): Promise<void> {
  const res = await fetch(`${MAILDEV_URL}/api/email`);
  for (const email of (await res.json()) as SentEmail[]) seenEmailIds.add(email.id);
}

/**
 * Polls MailDev's REST API (GET /api/email — see @maildev/api's server.js,
 * not the classic MailDev REST API's /api/emails) for an email matching
 * `matcher`, since the app sends mail asynchronously via a pg-boss queue
 * job rather than inline with the triggering request.
 *
 * Timeout is 45s, not the ~2-5s a single send normally takes under
 * `fixtures.ts`'s worker-scoped `seededOrg` (one `POST /demo-data/seed`
 * per spec file, not per test — see that fixture's own comment for why
 * this mattered: an earlier per-test-scoped version queued ~7 quote
 * sends × 25+ tests through the real `quote-send-email` pg-boss queue,
 * building a 100+ job backlog that starved later tests' own sends well
 * past even a 45s wait). The margin here is deliberate slack for a
 * genuinely async, queue-based send under normal load, not a workaround
 * for that now-fixed backlog issue.
 */
export async function waitForEmail(matcher: (email: SentEmail) => boolean, timeoutMs = 45_000): Promise<SentEmail> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MAILDEV_URL}/api/email`);
    const emails = (await res.json()) as SentEmail[];
    const found = emails.find((email) => !seenEmailIds.has(email.id) && matcher(email));
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No matching email arrived within ${timeoutMs}ms`);
}

/** Extracts the first http(s) URL from an email body (html preferred, falls back to text). */
export function extractLink(email: SentEmail): string {
  const body = email.html ?? email.text ?? "";
  const match = body.match(/https?:\/\/[^\s"'<>]+/);
  if (!match) {
    throw new Error(`No link found in email body: ${body.slice(0, 200)}`);
  }
  return match[0].replace(/&amp;/g, "&");
}

/** Signs up a brand-new org (first user becomes Primary Owner) and lands on /onboarding, then skips straight to /dashboard — mirrors CLAUDE.md's "onboarding is never a gate" rule. */
/** The API and the app's origin (Better Auth checks the Origin of a sign-in or sign-up). */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const APP_URL = process.env.APP_URL ?? "http://localhost:3110";

/**
 * A new account and business, signed in, with onboarding skipped, on the
 * dashboard — through the API rather than the sign-up and onboarding pages
 * (D-241: those have their own specs). The session cookie lands in the
 * page's browser context, exactly as signing up in the browser leaves it.
 */
export async function signUpNewOrg(page: Page, { name, email, password }: { name: string; email: string; password: string }): Promise<void> {
  const signUp = await page.request.post(`${API_URL}/api/auth/sign-up/email`, { data: { name, email, password }, headers: { Origin: APP_URL } });
  if (!signUp.ok()) throw new Error(`Sign-up failed: ${signUp.status()} ${await signUp.text()}`);
  const skip = await page.request.put(`${API_URL}/org/settings/onboarding_status`, { data: { value: { skipped: true } }, headers: { Origin: APP_URL, "Idempotency-Key": randomUUID() } });
  if (!skip.ok()) throw new Error(`Skipping onboarding failed: ${skip.status()} ${await skip.text()}`);
  await openSettledDashboard(page);
}

/**
 * Opens the dashboard, where the sign-up and login pages used to land, and
 * waits for the person's permissions to load (every signed-in page asks for
 * them), so a test reading the sidebar sees all of it. Other requests may
 * still be running: a test that intercepts requests or clears cookies next
 * should leave for `about:blank` first.
 */
export async function openSettledDashboard(page: Page): Promise<void> {
  const permissions = page.waitForResponse((res) => res.url().includes("/org/members/me/capabilities"), { timeout: 15_000 }).catch(() => null);
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  await permissions;
}

/**
 * Creates a contact and a one-line draft quote for them, sends it, and
 * returns the real public link read back from the email MailDev
 * received — same "no backdoor" approach as `quote-to-payment.spec.ts`'s
 * own flow, factored out here since the public-quote-page suite needs
 * this 3 times (accept/reject/already-resolved scenarios each need their
 * own distinct token).
 */
export async function sendQuoteAndGetPublicLink(
  page: Page,
  { contactName, contactEmail, itemName = "Consulting services", unitPrice = "1000" }: { contactName: string; contactEmail: string; itemName?: string; unitPrice?: string },
): Promise<string> {
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).first().click();
  await page.getByLabel("Full name").fill(contactName);
  await page.getByLabel("Email").fill(contactEmail);
  await page.getByRole("button", { name: "Save contact" }).click();
  await page.getByText(contactName).first().waitFor();

  await page.goto("/quotes/new");
  await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
  await page.getByPlaceholder("Search…").fill(contactName);
  await page.getByRole("option", { name: contactName }).click();

  await page.getByPlaceholder("Item name").fill(itemName);
  const unitPriceInput = page.getByLabel("Unit price").first();
  await unitPriceInput.fill(unitPrice);

  await page.getByRole("button", { name: /Save as draft/ }).click();
  await page.waitForURL(/\/quotes\/[a-f0-9-]+$/);

  await clearInbox();
  await page.getByRole("button", { name: "Send Quote" }).click();
  // US-SET-21: the send dialog starts from the Quote email template.
  await page.getByRole("dialog").getByRole("button", { name: "Send quote" }).click();
  await page.getByText(/^sent$/i).first().waitFor({ timeout: 10_000 });

  const email = await waitForEmail((e) => e.to.some((t) => t.address === contactEmail));
  return extractLink(email);
}
