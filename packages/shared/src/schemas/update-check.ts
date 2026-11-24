/**
 * US-OPS-06 (D-055, D-269) — the Owners' "a new version is available"
 * banner. The API checks the public repo's latest release once a day,
 * sending nothing about the install; `UPDATE_CHECK=off` turns it off.
 */
export const SPINE_RELEASES_REPO = "haribrothers/spine";

/** Where "How to update" goes until the docs site ships (US-SITE-*, Q-15). */
export const UPDATE_GUIDE_URL = "https://github.com/haribrothers/spine#updating";

export interface UpdateStatus {
  /** The version this server runs. */
  current: string;
  /** The latest release, when a check has found one. */
  latest?: string;
  /** That release's notes ("What's new"). */
  releaseUrl?: string;
  checkedAt?: string;
}

type Parsed = { core: number[]; pre: string[] };

function parse(version: string): Parsed | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(version.trim());
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split(".") : [] };
}

/** Semantic-version order: 1.0.0-beta.2 < 1.0.0-beta.10 < 1.0.0 < 1.0.1. False when either isn't a version. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i]! > b.core[i]!;
  }
  // A release is newer than its own pre-releases.
  if (!a.pre.length || !b.pre.length) return !a.pre.length && b.pre.length > 0;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return false;
    if (y === undefined) return true;
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) > Number(y);
    if (xn !== yn) return !xn;
    return x > y;
  }
  return false;
}

/** The version the banner offers, or null when this server is up to date (or nothing has been checked). */
export function availableUpdate(status: UpdateStatus | null): string | null {
  if (!status?.latest) return null;
  return isNewerVersion(status.latest, status.current) ? status.latest : null;
}

/** "Spine 1.1.0 is available." + "You're on 1.0.0. Updating runs database migrations automatically and takes a backup first." */
export function updateNotice(latest: string, current: string): { title: string; body: string } {
  return {
    title: `Spine ${latest} is available.`,
    body: `You're on ${current}. Updating runs database migrations automatically and takes a backup first.`,
  };
}
