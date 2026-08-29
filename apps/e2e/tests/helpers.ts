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

/** Clears MailDev's inbox — call before triggering an email-sending action so the next poll only sees emails from this test. */
export async function clearInbox(): Promise<void> {
  await fetch(`${MAILDEV_URL}/api/email/all`, { method: "DELETE" });
}

/**
 * Polls MailDev's REST API (GET /api/email — see @maildev/api's server.js,
 * not the classic MailDev REST API's /api/emails) for an email matching
 * `matcher`, since the app sends mail asynchronously via a pg-boss queue
 * job rather than inline with the triggering request.
 */
export async function waitForEmail(matcher: (email: SentEmail) => boolean, timeoutMs = 15_000): Promise<SentEmail> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MAILDEV_URL}/api/email`);
    const emails = (await res.json()) as SentEmail[];
    const found = emails.find(matcher);
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
export async function signUpNewOrg(page: Page, { name, email, password }: { name: string; email: string; password: string }): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Skip to dashboard" }).click();
  await page.waitForURL("**/dashboard");
}
