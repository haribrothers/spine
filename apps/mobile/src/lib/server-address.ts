/**
 * US-MOB-01 — the server address someone types: "the link you open Spine
 * with on a computer". It's normalised to an origin (plus any path), then
 * the API is looked for in two places: behind Caddy at `<address>/api`
 * (a real install, where `/api/*` is proxied to the API with the prefix
 * stripped) and at the address itself (the API's own port in development).
 *
 * Parsed by hand rather than with `URL`: React Native's `URL` doesn't
 * implement `hostname` and friends on every engine.
 */
const ADDRESS = /^(https?):\/\/([^/?#:@\s]+)(:\d{1,5})?(\/[^?#\s]*)?$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** "spine.example.com" → "https://spine.example.com"; null when it can't be a server address. */
export function normalizeServerAddress(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  const match = ADDRESS.exec(value);
  if (!match) return null;
  const [, scheme, host, port = "", path = ""] = match;
  const hostname = host!.toLowerCase();
  if (hostname !== "localhost" && !hostname.includes(".") && !IPV4.test(hostname)) return null;
  const trimmedPath = path.replace(/\/+$/, "");
  return `${scheme!.toLowerCase()}://${hostname}${port}${trimmedPath}`;
}

/** Where the API might answer for a normalised address, most likely first. */
export function apiBaseCandidates(server: string): string[] {
  const withoutApi = server.replace(/\/api$/i, "");
  return [`${withoutApi}/api`, withoutApi];
}

/** Better Auth's routes live under the API's own `/api/auth` base path. */
export function authUrl(apiBase: string, route: string): string {
  return `${apiBase}/api/auth/${route.replace(/^\//, "")}`;
}
