import type { INestApplication } from "@nestjs/common";

/**
 * US-OPS-18 (security review) — Spine runs behind a reverse proxy (Caddy in
 * docker-compose, Traefik on Coolify) on the same host or private network.
 * Trusting it makes `req.ip` the visitor's address from X-Forwarded-For, so
 * the public routes' rate limits apply per visitor, not once for everyone
 * behind the proxy. Only loopback and private-network proxies are trusted,
 * so a visitor on the internet can't set their own address. `TRUST_PROXY`
 * overrides it with any Express `trust proxy` value (e.g. `false` when the
 * API is reached directly).
 */
export const DEFAULT_TRUST_PROXY = "loopback, linklocal, uniquelocal";

export function trustProxy(app: INestApplication, value = process.env.TRUST_PROXY?.trim() || DEFAULT_TRUST_PROXY): void {
  const parsed = value === "false" ? false : value === "true" ? true : /^\d+$/.test(value) ? Number(value) : value;
  (app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set("trust proxy", parsed);
}
