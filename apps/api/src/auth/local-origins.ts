import { isIP } from "node:net";

/**
 * D-279: Spine opens on any local address — http://localhost:7746 on the
 * machine itself, http://<its IP>:7746 from the rest of the network — while
 * APP_URL stays the one address written into links. Sign-in (Better Auth's
 * origin check) trusts APP_URL, plus a request's own origin when both hold:
 *
 * - it's the same address the request came to (Origin equals Host), so a page
 *   on another site or another device can't sign in or act with the session;
 * - that address is local: localhost, a private or Tailscale IP, or a
 *   `.local`-style name. A public domain that isn't APP_URL is refused, so a
 *   public name pointed at a private IP (DNS rebinding) gets nowhere.
 *
 * Host is the browser's own: Caddy passes it through unchanged, and the API's
 * port is never published.
 */
export function sameLocalOrigin(request: Request | undefined): string[] {
  if (!request) return [];
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return [];
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return [];
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return [];
  if (url.host !== host.trim().toLowerCase()) return [];
  return isLocalHostname(url.hostname) ? [url.origin] : [];
}

const LOCAL_SUFFIXES = [".localhost", ".local", ".lan", ".home.arpa", ".internal"];

/** localhost, a loopback, private, link-local or Tailscale (100.64/10) IP, or a name that only resolves on the local network. */
export function isLocalHostname(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (name === "localhost" || LOCAL_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  const version = isIP(name);
  if (version === 4) {
    const [a = 0, b = 0] = name.split(".").map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (version === 6) {
    if (name === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(name);
    if (mapped) return isLocalHostname(mapped[1]!);
    // fc00::/7 (unique local) and fe80::/10 (link-local).
    return /^f[cd][0-9a-f]{0,2}:/.test(name) || /^fe[89ab][0-9a-f]?:/.test(name);
  }
  return false;
}
