import Constants from "expo-constants";
import { isPrerelease } from "@spine/shared";

/** The marketing version sent as `X-Spine-Client-Version` (D-071): `X.Y.Z`, as the stores take it. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";

/** US-MOB-28 — the product version this build is, `1.0.0-beta.1` for a beta (app.config.js). */
export const SPINE_VERSION: string = (Constants.expoConfig?.extra?.spineVersion as string | undefined) ?? APP_VERSION;

/** The store build number, shown next to the version on Profile. */
export const APP_BUILD: string | null =
  (Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString()) || null;

/** Profile's version line: "Spine 1.0.0-beta.1 (12) · Beta". */
export function versionLine(version: string = SPINE_VERSION, build: string | null = APP_BUILD): string {
  return `Spine ${version}${build ? ` (${build})` : ""}${isPrerelease(version) ? " · Beta" : ""}`;
}
