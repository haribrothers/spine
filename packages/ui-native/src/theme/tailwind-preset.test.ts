import { darkColors, lightColors } from "../tokens";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { themeExtend } = require("../../tailwind-preset") as { themeExtend: { colors: Record<string, string> } };

describe("tailwind preset colours", () => {
  it("has a kebab-case class for every flat colour token, light and dark", () => {
    const kebab = (key: string) => key.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
    const missing = Object.entries(lightColors)
      .filter(([, value]) => typeof value === "string")
      .flatMap(([key]) => [kebab(key), `${kebab(key)}-dark`])
      .filter((cls) => !(cls in themeExtend.colors));
    expect(missing).toEqual([]);
  });

  it("puts the D-099 text-on-fill colours on text-on-primary and text-on-danger", () => {
    expect(themeExtend.colors["on-primary"]).toBe(lightColors.onPrimary);
    expect(themeExtend.colors["on-primary-dark"]).toBe(darkColors.onPrimary);
    expect(themeExtend.colors["on-danger"]).toBe(lightColors.onDanger);
  });

  it("takes the Android Material 3 roles from tokens.json (US-MOB-20)", () => {
    const tokens = require("../../../../docs/design/tokens.json") as { color: Record<string, Record<string, string>> };
    for (const [scheme, colors] of [["android", lightColors], ["android-dark", darkColors]] as const) {
      expect([colors.primaryContainer, colors.onPrimaryContainer, colors.surfaceContainer, colors.outlineVariant, colors.outline]).toEqual([
        tokens.color[scheme]!["primary-container"],
        tokens.color[scheme]!["on-primary-container"],
        tokens.color[scheme]!["surface-container"],
        tokens.color[scheme]!["outline-variant"],
        tokens.color[scheme]!["outline"],
      ]);
    }
    expect(themeExtend.colors["primary-container-dark"]).toBe(darkColors.primaryContainer);
  });
});
