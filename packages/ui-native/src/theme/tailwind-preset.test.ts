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
});
