import Constants from "expo-constants";

/** The marketing version sent as `X-Spine-Client-Version` (D-071) and shown on Profile. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";

/** The store build number, shown next to the version on Profile. */
export const APP_BUILD: string | null =
  (Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString()) || null;
