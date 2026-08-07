import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { PublicQuotesService, type RequestProvenance } from "./public-quotes.service";

interface RespondBody {
  comment?: unknown;
}

/**
 * PRD F3 Stage 3 (S-03.5/S-03.6, §10.3) — the public, unauthenticated
 * counterpart to `QuotesController`. Deliberately a SEPARATE controller
 * (not a route on `QuotesController`, which carries a blanket
 * `@OrgRoles(["owner", "staff"])`) — these three routes must be reachable
 * with ZERO session/auth, gated only by the signed token itself. Registered
 * under `/public/quotes` so nothing here can ever collide with or be
 * mistaken for an authenticated `/quotes/*` route.
 *
 * Rate limited per §10.3's explicit "with rate limiting" — `@Throttle`
 * overrides this controller's routes to a tighter limit than
 * `ThrottlerModule`'s app-wide default (see app.module.ts), since this is
 * the one place in the API an anonymous, unauthenticated caller can hit
 * with no cost at all (no login, no org membership) — the natural target
 * for scripted abuse (token-guessing, or hammering accept/reject). 20
 * requests/minute per IP, in-memory (no Redis — single-host deployment per
 * CLAUDE.md's stack table).
 *
 * `@Public()` (from `@thallesp/nestjs-better-auth`) is required here on top
 * of simply never reading `@Session()` — this codebase's `AuthModule` wires
 * a global auth guard (see AppModule) that otherwise rejects EVERY route
 * with no session (401), including brand new ones that never opted into
 * auth in the first place. Without this decorator these routes would 401
 * before ever reaching `PublicQuotesService`, which defeats the entire
 * point of an unauthenticated public link.
 */
@Controller("public/quotes")
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicQuotesController {
  constructor(private readonly publicQuotes: PublicQuotesService) {}

  @Get(":token")
  async view(@Param("token") token: string, @Req() req: Request) {
    return this.publicQuotes.view(token, provenanceOf(req));
  }

  @Post(":token/accept")
  async accept(@Param("token") token: string, @Body() body: RespondBody, @Req() req: Request) {
    return this.publicQuotes.accept(token, normalizeComment(body?.comment), provenanceOf(req));
  }

  @Post(":token/reject")
  async reject(@Param("token") token: string, @Body() body: RespondBody, @Req() req: Request) {
    return this.publicQuotes.reject(token, normalizeComment(body?.comment), provenanceOf(req));
  }
}

function normalizeComment(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, 2000) : undefined;
}

/** `req.ip` respects Express's `trust proxy` setting; falls back to the raw socket address. Both nullable — a public, unauthenticated caller's network info is best-effort provenance, not a hard requirement. */
function provenanceOf(req: Request): RequestProvenance {
  return {
    ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  };
}
