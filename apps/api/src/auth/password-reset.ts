import { Logger } from "@nestjs/common";
import { EmailService } from "../modules/email/email.service";

/** US-AUTH-09 — how long a reset link works (seconds). The copy says "expires in 1 hour". */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/** Requests from one IP address: 10 per 15 minutes, then 429. */
export const RESET_IP_LIMIT = { max: 10, windowMs: 15 * 60_000 };
/** Emails to one address: 3 per hour. Further requests still answer "Check your email" but send nothing. */
export const RESET_EMAIL_LIMIT = { max: 3, windowMs: 60 * 60_000 };

export const RESET_TOO_MANY_MESSAGE = "Too many reset requests from this network. Wait 15 minutes and try again.";

/**
 * A fixed-size sliding window per key, kept in memory. Spine runs one API
 * process (02-architecture), so a restart resetting the counts is the only
 * gap, and it only ever loosens the limit for a few minutes.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: { max: number; windowMs: number }) {}

  /** Records a hit; false when the key is already at its limit (the hit isn't counted). */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.limit.windowMs);
    if (recent.length >= this.limit.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.limit.windowMs)) this.hits.delete(key);
    }
  }
}

export const resetIpLimiter = new SlidingWindowLimiter(RESET_IP_LIMIT);
export const resetEmailLimiter = new SlidingWindowLimiter(RESET_EMAIL_LIMIT);

const logger = new Logger("PasswordReset");

export function resetPasswordUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Better Auth's `sendResetPassword`. The link goes to the web app's
 * `/reset-password` page, not Better Auth's own redirecting route. Without
 * SMTP nothing is sent and the page still says "Check your email" (D-084):
 * the answer never reveals whether an account or a mail server exists.
 * The token is never logged.
 */
export async function sendResetPasswordEmail(data: { user: { email: string; name: string }; token: string }): Promise<void> {
  const email = data.user.email.toLowerCase();
  if (!resetEmailLimiter.hit(email)) {
    logger.warn("Password reset email skipped: this address reached its hourly limit");
    return;
  }
  const emailService = new EmailService();
  if (!emailService.isConfigured()) {
    logger.warn("Password reset requested, but email (SMTP) isn't configured, so no link was sent");
    return;
  }
  const url = resetPasswordUrl(data.token);
  try {
    await emailService.send({
      to: data.user.email,
      subject: "Reset your Spine password",
      text: `Hi ${data.user.name},\n\nSomeone asked to reset the password for this Spine account. Choose a new password here:\n\n${url}\n\nThe link works once and expires in 1 hour. Choosing a new password signs you out on your other devices.\n\nIf you didn't ask for this, you can ignore this email. Your password stays the same.`,
      html: `<p>Hi ${escapeHtml(data.user.name)},</p><p>Someone asked to reset the password for this Spine account.</p><p><a href="${url}">Choose a new password</a></p><p>The link works once and expires in 1 hour. Choosing a new password signs you out on your other devices.</p><p>If you didn't ask for this, you can ignore this email. Your password stays the same.</p>`,
    });
  } catch (err) {
    // An SMTP outage must not turn into a different answer on the page.
    logger.error("Password reset email failed to send", err instanceof Error ? err.message : String(err));
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
