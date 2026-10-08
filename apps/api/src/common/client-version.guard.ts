import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import { CLIENT_TOO_OLD_ERROR, CLIENT_TOO_OLD_MESSAGE, CLIENT_VERSION_HEADER, isClientTooOld } from "@spine/shared";

/**
 * D-071 / US-MOB-10 — the field app sends `X-Spine-Client-Version` on every
 * request; when the server sets `MOBILE_MIN_VERSION` and the app is older,
 * every request is answered 426 `CLIENT_TOO_OLD` so an old app never writes
 * against a changed API. The app keeps its outbox and shows "Update Spine to
 * keep going". Requests without the header (the web app, scripts) and a
 * server without a minimum are never affected.
 */
@Injectable()
export class ClientVersionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const minimum = process.env.MOBILE_MIN_VERSION?.trim();
    if (!minimum) return true;
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.[CLIENT_VERSION_HEADER.toLowerCase()];
    const version = Array.isArray(header) ? header[0] : header;
    if (typeof version !== "string" || !isClientTooOld(version, minimum)) return true;
    throw new HttpException({ statusCode: 426, error: CLIENT_TOO_OLD_ERROR, message: CLIENT_TOO_OLD_MESSAGE, minimumVersion: minimum }, 426);
  }
}
