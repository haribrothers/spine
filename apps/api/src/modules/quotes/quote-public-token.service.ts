import { Inject, Injectable, Logger } from "@nestjs/common";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { quotePublicTokens } from "../../db/schema";

/** How long a freshly-minted quote link stays valid, absent any other resolution (accept/reject/revise/re-send) — generous since a customer may take days to decide; this is a ceiling, not the expected turnaround. */
const TOKEN_TTL_DAYS = 30;

export interface IssuedQuoteToken {
  /** The opaque, URL-safe signed token — this is the whole `:token` path segment in `GET /public/quotes/:token` and `${APP_URL}/quote/:token`. */
  token: string;
  nonce: string;
  expiresAt: Date;
}

export interface VerifiedQuoteToken {
  quoteId: string;
  orgId: string;
  nonce: string;
}

/**
 * PRD F3 Stage 3, §10.3 ("Signed, expiring, single-purpose tokens for
 * public quote links, with rate limiting") — the token half of the design;
 * `quote_public_tokens` (schema) is the DB half. See that table's own doc
 * comment for the full reasoning on why both a signed JWT AND a DB row
 * exist together, and for what "single-purpose" is taken to mean here
 * (scoped to one quote, reusable-until-resolved — not one-time-use).
 *
 * Signing key: `AUTH_SECRET` (already a required boot env var per
 * CLAUDE.md's "3 required env vars" rule — no new required var needed).
 * Uses `jose`'s HMAC (`HS256`) — symmetric, fine here since the only
 * verifier is this same API process, not a third party.
 */
@Injectable()
export class QuotePublicTokenService {
  private readonly logger = new Logger(QuotePublicTokenService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private getSecretKey(): Uint8Array {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      // Unreachable in practice — the app doesn't boot without AUTH_SECRET
      // (CLAUDE.md's 3-required-env-vars rule; auth.ts already reads it
      // unconditionally). Guarded anyway so this service never silently
      // signs with `undefined`.
      throw new Error("AUTH_SECRET is required to issue quote tokens");
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Mints a fresh token + DB row for `quoteId`, inside the caller's own
   * transaction (called from `QuotesService.send()`, which is itself
   * transactional) so a token is never issued for a send that ends up
   * rolling back.
   */
  async issue(tx: Transaction, orgId: string, quoteId: string): Promise<IssuedQuoteToken> {
    const nonce = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await tx.insert(quotePublicTokens).values({ nonce, quoteId, orgId, expiresAt });

    const token = await new SignJWT({ quoteId, orgId, nonce })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.getSecretKey());

    return { token, nonce, expiresAt };
  }

  /**
   * Verifies a token's signature + JWT-level expiry, then cross-checks the
   * DB row (revocation + the row's own `expiresAt`, the actual source of
   * truth — see quote_public_tokens's doc comment). Returns null for ANY
   * failure (bad signature, malformed, expired, revoked, DB row missing) —
   * deliberately not distinguishing the reason in the return value, since
   * every caller's response to the customer is the same generic "this link
   * is no longer valid," never leaking which specific check failed (a
   * signature-tamper attempt and a naturally-expired link should look
   * identical from the outside).
   */
  async verify(token: string): Promise<VerifiedQuoteToken | null> {
    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(token, this.getSecretKey());
      payload = result.payload;
    } catch (err) {
      if (!(err instanceof joseErrors.JWTExpired) && !(err instanceof joseErrors.JWSSignatureVerificationFailed)) {
        this.logger.warn(`Unexpected error verifying a public quote token: ${(err as Error).message}`);
      }
      return null;
    }

    if (typeof payload.quoteId !== "string" || typeof payload.orgId !== "string" || typeof payload.nonce !== "string") {
      return null;
    }

    const [row] = await this.db.select().from(quotePublicTokens).where(eq(quotePublicTokens.nonce, payload.nonce));
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    // Belt-and-suspenders: the DB row's own quoteId/orgId must match what
    // the signed payload claims — they always should (the row is what the
    // token was minted from), but a mismatch would mean something is very
    // wrong, so fail closed rather than trust either source alone.
    if (row.quoteId !== payload.quoteId || row.orgId !== payload.orgId) {
      return null;
    }

    return { quoteId: row.quoteId, orgId: row.orgId, nonce: row.nonce };
  }

  /**
   * Revokes every still-live token for `quoteId` — called by
   * `QuotesService.revise()` (a superseded quote's old link must stop
   * working, per the task brief's own reasoning) and available for a future
   * "resend" affordance to void a prior link before minting a new one.
   * Takes the caller's transaction for the same reason `issue()` does.
   */
  async revokeAllForQuote(tx: Transaction, quoteId: string): Promise<void> {
    await tx
      .update(quotePublicTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(quotePublicTokens.quoteId, quoteId), isNull(quotePublicTokens.revokedAt)));
  }
}
