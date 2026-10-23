/**
 * US-OPS-52 (D-262, D-265) — a pre-release (`1.0.0-beta.1`, `1.0.0-rc.1`) is
 * shown with a "Beta" label wherever the version is: Settings › About and the
 * field app's Profile.
 */
export function isPrerelease(version: string | null | undefined): boolean {
  return Boolean(version && /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(version));
}

/** The note under a beta's version. */
export const BETA_NOTE = "This is a beta of Spine: try everything, and expect changes before 1.0. Tell whoever invited you about anything that looks wrong.";
