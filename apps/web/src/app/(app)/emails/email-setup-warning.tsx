"use client";

import { Alert, AlertDescription } from "@spine/ui";
import type { EmailLogStatusSummary } from "@spine/shared";

const plural = (n: number) => `${n} ${n === 1 ? "email is" : "emails are"}`;

/**
 * US-SET-29 (D-220) — on the email log and Settings › Emails: email isn't
 * set up (and how many emails are waiting for it), or the last 3 queued
 * emails in a row failed. Nothing when email is working.
 */
export function EmailSetupWarning({ status }: { status: EmailLogStatusSummary | null }) {
  if (!status) return null;
  if (!status.smtpConfigured) {
    return (
      <Alert variant="warning" data-testid="email-setup-warning">
        <AlertDescription>
          <strong className="font-semibold">Email isn&apos;t set up — {plural(status.waiting)} waiting.</strong> Set <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_HOST</code> (and{" "}
          <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_USER</code>, <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_PASSWORD</code>,{" "}
          <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_FROM</code>) on the server, then restart Spine; waiting emails go out once it&apos;s set.
        </AlertDescription>
      </Alert>
    );
  }
  if (status.lastError) {
    return (
      <Alert variant="critical" data-testid="email-setup-warning">
        <AlertDescription>
          <strong className="font-semibold">Emails are failing</strong> — the last error was: {status.lastError}. Check the server&apos;s email settings, then retry the failed emails below.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
