/**
 * US-MOB-27 (D-203) — the Spine brand colours from tokens.json `color.brand`
 * and `color.gradients.brand`, the same in light and dark mode.
 *
 * Decorative only: the logo, the app icon, the splash and illustrations.
 * Text, buttons and status keep `primary` and the status tokens (whose
 * contrast is checked), which is why these sit outside `lightColors` /
 * `darkColors` and get no Tailwind class.
 */
export const brandColors = {
  teal: "#04E9BC",
  sky: "#51A5F8",
  deep: "#054DC1",
  gradients: {
    /** The app icon's tile. */
    icon: { from: "#04E9BC", to: "#054DC1" },
    /** The mark's three layers, top to bottom. */
    layerTop: { from: "#5DF3BD", to: "#10A9C2" },
    layerMid: { from: "#A8E1E3", to: "#63A4E0" },
    layerBase: { from: "#69AAE1", to: "#0545AF" },
  },
} as const;

export type BrandGradient = keyof typeof brandColors.gradients;
