/**
 * What can go wrong talking to the Spine server, as the screens need to
 * tell it apart (US-MOB-10): no network at all is "You're offline" (the
 * saved data, Group 3), an online phone whose server doesn't answer is
 * "Couldn't load", a too-old app is "Update Spine to keep going", and a
 * removed or expired session sends the person back to Sign in.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The phone has no network. */
export class OfflineError extends Error {
  constructor() {
    super("You're offline.");
    this.name = "OfflineError";
  }
}

/** The phone is online but the server didn't answer (timeout, refused, 502–504). */
export class ServerUnreachableError extends Error {
  constructor() {
    super("The Spine server didn't answer.");
    this.name = "ServerUnreachableError";
  }
}

/** 426 CLIENT_TOO_OLD — the server needs a newer app (D-071). */
export class UpdateRequiredError extends Error {
  constructor(readonly minimumVersion?: string) {
    super("Update Spine to keep going");
    this.name = "UpdateRequiredError";
  }
}

/** 403 ACCESS_REMOVED — this person's membership was deactivated. `message` names the business. */
export class AccessRemovedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRemovedError";
  }
}

/** 403 PASSWORD_CHANGE_REQUIRED — an Owner set this password; choose your own first (US-TEAM-24). */
export class PasswordChangeRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordChangeRequiredError";
  }
}

/** 401 — the session expired or was revoked elsewhere. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session ended. Sign in again.");
    this.name = "SessionExpiredError";
  }
}
