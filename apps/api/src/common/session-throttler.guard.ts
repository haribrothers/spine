import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerRequest } from "@nestjs/throttler";

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/;

/** The caller's session token from the cookie or a Bearer header (the phone app), if any. */
function sessionToken(req: { headers?: Record<string, string | string[] | undefined> }): string | null {
  const cookie = req.headers?.cookie;
  const fromCookie = typeof cookie === "string" ? SESSION_COOKIE.exec(cookie)?.[1] : undefined;
  if (fromCookie) return decodeURIComponent(fromCookie);
  const auth = req.headers?.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

/**
 * Rate limits count signed-in requests per session, not per IP address.
 * The web app's server makes its calls (session, membership, locale) from
 * one address for every user, and an office shares one address, so a
 * per-IP count throttled whole teams at 300 a minute. Public routes
 * (`@Public`) still count per IP, so made-up cookies can't dodge their
 * limits; a made-up cookie elsewhere is refused by the auth guard anyway.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("PUBLIC", [props.context.getHandler(), props.context.getClass()]);
    const req = props.context.switchToHttp().getRequest<{ spineThrottleByIp?: boolean }>();
    req.spineThrottleByIp = Boolean(isPublic);
    return super.handleRequest(props);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> { // eslint-disable-line @typescript-eslint/no-explicit-any -- ThrottlerGuard's own signature
    if (!req.spineThrottleByIp) {
      const token = sessionToken(req);
      if (token) return `session:${createHash("sha256").update(token).digest("hex")}`;
    }
    return super.getTracker(req);
  }
}
