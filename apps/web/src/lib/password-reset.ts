"use client";

import { authClient } from "./auth-client";
import { t } from "./i18n";

/** US-AUTH-09 — the resend button stays disabled this long after a request. */
export const RESEND_AFTER_SECONDS = 60;

const STORAGE_KEY = "spine.passwordReset";

export interface ResetRequest {
  email: string;
  sentAt: number;
}

/**
 * The address is kept in this tab's sessionStorage for the "Check your
 * email" page, never in the URL.
 */
export function readResetRequest(): ResetRequest | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ResetRequest) : null;
    return parsed && typeof parsed.email === "string" && typeof parsed.sentAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function saveResetRequest(request: ResetRequest) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(request));
  } catch {
    // Private mode: the sent page falls back to the form.
  }
}

/**
 * Asks for a reset link. Resolves with an error message only when the
 * request couldn't be made (too many requests, no connection); the server's
 * answer is otherwise the same whether or not the account exists.
 */
export async function requestResetLink(email: string): Promise<string | null> {
  try {
    const { error } = await authClient.requestPasswordReset({ email });
    if (error) {
      if (error.status === 429) return error.message ?? t("auth.passwordReset.tooManyRequests");
      if (error.status === 400) return t("auth.passwordReset.invalidEmail");
      return t("auth.passwordReset.sendFailed");
    }
  } catch {
    return t("auth.passwordReset.unreachable");
  }
  saveResetRequest({ email, sentAt: Date.now() });
  return null;
}

/** "0:45" */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
