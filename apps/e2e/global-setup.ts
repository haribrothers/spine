/**
 * Clears MailDev's inbox once, before the whole suite runs — a local
 * MailDev instance persists across separate `pnpm test:e2e` invocations
 * (it's a long-lived docker-compose.dev.yml service, not started/stopped
 * per run), so leftover emails from a previous run — or from manual
 * dev-server poking against the same MailDev instance — would otherwise
 * accumulate indefinitely. `waitForEmail`'s own per-test `clearInbox()`
 * calls handle inter-test noise within a single run; this handles noise
 * carried over BETWEEN runs.
 */
async function globalSetup(): Promise<void> {
  const maildevUrl = process.env.MAILDEV_URL ?? "http://localhost:1080";
  await fetch(`${maildevUrl}/api/email/all`, { method: "DELETE" }).catch(() => {});
}

export default globalSetup;
