/**
 * Phase 5 — the contract between the field app and the API that isn't a
 * route: the client-version header (D-071, US-MOB-10) and the error the API
 * answers when a member's access was removed (US-MOB-02, US-TEAM-04).
 */

/** Sent by the field app on every request: its own marketing version, "X.Y.Z". */
export const CLIENT_VERSION_HEADER = "X-Spine-Client-Version";

/** 426 — the app is older than the server's `MOBILE_MIN_VERSION`. */
export const CLIENT_TOO_OLD_ERROR = "CLIENT_TOO_OLD";
export const CLIENT_TOO_OLD_MESSAGE = "Update Spine to keep going";

/** 403 — the caller's membership of the active organisation was deactivated. */
export const ACCESS_REMOVED_ERROR = "ACCESS_REMOVED";

/** "Your access to <Business> was removed." */
export function accessRemovedMessage(businessName: string): string {
  return `Your access to ${businessName} was removed.`;
}

/** Parses "1.2.3" (a leading "v" and a pre-release suffix are ignored); null when it isn't a version. */
export function parseVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `version` is below `minimum`. An unparseable value on either side never blocks. */
export function isClientTooOld(version: string, minimum: string): boolean {
  const have = parseVersion(version);
  const need = parseVersion(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i]! !== need[i]!) return have[i]! < need[i]!;
  }
  return false;
}
