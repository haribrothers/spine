import { createHmac, timingSafeEqual } from "node:crypto";

/** Session-less file links never live longer than this (US-OPS-27). */
export const MAX_FILE_LINK_SECONDS = 5 * 60;

function signature(fileId: string, exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`file:${fileId}:${exp}`).digest("base64url");
}

/**
 * Signs `GET /files/:id?exp=&sig=` for a reader that has no session (for
 * example an email client or a native image loader). The caller must have
 * checked the person may read the file before asking for a link.
 */
export function signFileLink(
  fileId: string,
  secret: string,
  ttlSeconds = MAX_FILE_LINK_SECONDS,
  now = Date.now(),
): { exp: number; sig: string } {
  const exp = Math.floor(now / 1000) + Math.min(Math.max(ttlSeconds, 1), MAX_FILE_LINK_SECONDS);
  return { exp, sig: signature(fileId, exp, secret) };
}

/** True when the link is for this file, untampered, unexpired and within the 5-minute limit. */
export function verifyFileLink(
  fileId: string,
  exp: string | number | undefined,
  sig: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!sig || exp === undefined || !secret) return false;
  const expNumber = Number(exp);
  if (!Number.isInteger(expNumber)) return false;
  const nowSeconds = Math.floor(now / 1000);
  if (expNumber < nowSeconds || expNumber > nowSeconds + MAX_FILE_LINK_SECONDS) return false;
  const expected = Buffer.from(signature(fileId, expNumber, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
