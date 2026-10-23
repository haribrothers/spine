/**
 * US-OPS-51 — the API's address as the browser should use it. A release image
 * is built once for every install, so it's built with `NEXT_PUBLIC_API_URL=/api`:
 * Caddy serves the API on the same origin under `/api`, whatever the domain.
 * Better Auth's client needs an absolute address, so a path is resolved
 * against the page's own origin; during server rendering, the web server's
 * own `API_URL` is used instead. Development keeps an absolute address
 * (`http://localhost:4000`).
 */
export function absoluteApiUrl(value: string | undefined = process.env.NEXT_PUBLIC_API_URL): string {
  const url = value ?? "http://localhost:4000";
  if (!url.startsWith("/")) return url;
  if (typeof window !== "undefined") return `${window.location.origin}${url}`;
  return process.env.API_URL ?? "http://localhost:4000";
}
