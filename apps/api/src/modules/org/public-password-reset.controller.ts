import { Controller, Get, NotFoundException, Param, Redirect } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@thallesp/nestjs-better-auth";
import { auth } from "../../auth/auth";

export const RESET_LINK_INVALID_MESSAGE = "This reset link can't be used. It may have expired or already been used.";

/**
 * US-AUTH-09/10 — the public pieces around Better Auth's own
 * `request-password-reset` and `reset-password` endpoints.
 */
@Controller("public")
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicPasswordResetController {
  /**
   * The reset page shows "For <email>." before anything changes. Knowing
   * the emailed token is the proof, the same trust model as an invitation
   * link; the token isn't consumed here.
   */
  @Get("password-reset/:token")
  async lookup(@Param("token") token: string) {
    const ctx = await auth.$context;
    const verification = await ctx.internalAdapter.findVerificationValue(`reset-password:${token}`);
    if (!verification || verification.expiresAt < new Date()) throw new NotFoundException(RESET_LINK_INVALID_MESSAGE);
    const user = await ctx.internalAdapter.findUserById(verification.value);
    if (!user) throw new NotFoundException(RESET_LINK_INVALID_MESSAGE);
    return { email: user.email };
  }

  /**
   * The phone app only knows the API's address; "Forgot password?" there
   * opens this in the phone's browser, which lands on the web page (D-052).
   */
  @Get("forgot-password")
  @Redirect()
  forgotPassword() {
    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return { url: `${appUrl}/forgot-password`, statusCode: 302 };
  }
}
