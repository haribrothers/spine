"use client";

import { Alert, AlertDescription } from "@spine/ui";
import type { EmailLogStatusSummary } from "@spine/shared";
import { useT } from "../../../lib/i18n";

/**
 * US-SET-29 (D-220) — on the email log and Settings › Emails: email isn't
 * set up (and how many emails are waiting for it), or the last 3 queued
 * emails in a row failed. Nothing when email is working.
 */
export function EmailSetupWarning({ status }: { status: EmailLogStatusSummary | null }) {
  const t = useT();
  if (!status) return null;
  if (!status.smtpConfigured) {
    return (
      <Alert variant="warning" data-testid="email-setup-warning">
        <AlertDescription>
          <strong className="font-semibold">{t("emails.setupWarning.notSetUp", { count: status.waiting })}</strong>{t("emails.setupWarning.set")}<code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_HOST</code>{t("emails.setupWarning.and")}{" "}
          <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_USER</code>, <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_PASSWORD</code>,{" "}
          <code className="rounded-sm bg-surface/70 px-1 font-mono text-[12.5px]">SMTP_FROM</code>{t("emails.setupWarning.afterVariables")}
        </AlertDescription>
      </Alert>
    );
  }
  if (status.lastError) {
    return (
      <Alert variant="critical" data-testid="email-setup-warning">
        <AlertDescription>
          <strong className="font-semibold">{t("emails.setupWarning.failingTitle")}</strong>{t("emails.setupWarning.failingBody", { error: status.lastError })}
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
