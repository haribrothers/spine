import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { PASSWORD_CHANGE_REQUIRED_ERROR, PASSWORD_CHANGE_REQUIRED_MESSAGE } from "@spine/shared";
import { DATABASE } from "../db/db.module";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import { auth } from "./auth";

const ALLOW_KEY = "allowBeforePasswordChoice";

/** A route a person can use while they still have to choose their own password (who they are; choosing it). */
export const AllowBeforePasswordChoice = () => SetMetadata(ALLOW_KEY, true);

/**
 * US-TEAM-24 (D-233) — after an Owner sets someone's password, every
 * signed-in request but the few marked `@AllowBeforePasswordChoice()` is
 * answered 403 `PASSWORD_CHANGE_REQUIRED` until they choose their own. The
 * web app and the field app send them to "Choose your own password" on it.
 * Better Auth's own routes (sign-out among them) aren't Nest routes, so
 * they're never held up.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const session = request.session ?? (await auth.api.getSession({ headers: request.headers ? fromNodeHeaders(request.headers) : new Headers() }));
    const userId: string | undefined = session?.user?.id;
    if (!userId) return true;
    const [row] = await this.db.select({ must: user.mustChangePassword }).from(user).where(eq(user.id, userId));
    if (!row?.must) return true;
    throw new ForbiddenException({ statusCode: 403, error: PASSWORD_CHANGE_REQUIRED_ERROR, message: PASSWORD_CHANGE_REQUIRED_MESSAGE });
  }
}
