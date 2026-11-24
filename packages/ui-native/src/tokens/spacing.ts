/** Ported from docs/DESIGN.md's `rounded`/`spacing` blocks — see colors.ts's own doc comment on why these are plain values, not CSS custom properties. */
export const radius = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
  "2xl": 48,
} as const;
