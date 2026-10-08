/**
 * D-068 — controls for a feature that ships in a later phase stay hidden
 * behind a flag here until that phase turns it on.
 */
export const FEATURE_FLAGS = {
  /** US-SITE-11, US-SITE-12 (Phase 11): "How it works" links to the guide bundled with the server. */
  bundledHelp: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const isFeatureOn = (flag: FeatureFlag): boolean => FEATURE_FLAGS[flag];
