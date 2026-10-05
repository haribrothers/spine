"use client";

import { useEffect } from "react";
import { THEME_PRESETS, type ThemePreset } from "@spine/shared";

/** Puts the organisation's theme on <html> (`data-brand`), where the preset CSS rules read it. */
export function applyThemePreset(preset: ThemePreset): void {
  document.documentElement.dataset.brand = preset;
}

const KNOWN = THEME_PRESETS.map((p) => p.id);

/**
 * US-SET-09 — applies the organisation's theme preset for every member.
 * The inline script sets `data-brand` while the page is still parsing, so a
 * themed organisation never flashes Spine Blue on a full load; the effect
 * keeps it right after client-side navigation. The preset id comes from a
 * fixed list, never free text, before it reaches the script.
 */
export function OrgThemePreset({ preset }: { preset: ThemePreset }) {
  const safe = KNOWN.includes(preset) ? preset : "spine-blue";
  useEffect(() => applyThemePreset(safe), [safe]);
  return <script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.brand=${JSON.stringify(safe)};` }} />;
}
