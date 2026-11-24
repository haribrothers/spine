import type { EmailLogEntry } from "@spine/shared";

/** A sent quote email; override what a test needs. */
export function email(overrides: Partial<EmailLogEntry> = {}): EmailLogEntry {
  return {
    id: overrides.id ?? "e1",
    kind: "quote",
    toAddress: "ananya.rao@example.com",
    toName: "Ananya Rao",
    subject: "Quote QUO-0034 — Bathroom refit",
    entityType: "quote",
    entityId: "q1",
    recordLabel: "QUO-0034",
    status: "sent",
    attempts: 1,
    maxAttempts: 4,
    lastError: null,
    canRetry: false,
    canCancel: false,
    nextAttemptAt: null,
    waitingForSetup: false,
    queuedAt: "2026-10-11T06:18:00.000Z",
    sentAt: "2026-10-11T06:18:05.000Z",
    failedAt: null,
    cancelledAt: null,
    cancelledByName: null,
    ...overrides,
  };
}
