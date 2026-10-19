import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * D-163 — secrets an Owner gives Spine (the AI provider's key) are stored
 * encrypted with AES-256-GCM, under a key derived from `AUTH_SECRET` for
 * that purpose alone (HKDF-SHA256). Nothing else can read them back; if
 * `AUTH_SECRET` changes, `openSecret` returns null and the Owner re-enters
 * the key. Never log what goes in or comes out.
 */
const VERSION = "v1";

function keyFor(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set to store secrets.");
  return Buffer.from(hkdfSync("sha256", secret, "spine-secret-box", purpose, 32));
}

export function sealSecret(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** The secret, or null when it can't be read (another `AUTH_SECRET`, or tampered with). */
export function openSecret(sealed: string | null | undefined, purpose: string): string | null {
  if (!sealed) return null;
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
