import { describe, expect, it } from "vitest";
import { isCommonPassword, passwordProblem, passwordStrength, PASSWORD_CHECK_LABELS, PASSWORD_LEVEL_LABELS, PASSWORD_TOO_COMMON_MESSAGE, PASSWORD_TOO_SHORT_MESSAGE } from "./password.ts";

describe("US-AUTH-15 · choose a strong password I can see", () => {
  it("rates passwords from too short to strong, as drawn", () => {
    expect(passwordStrength("abc1").level).toBe("too-short");
    expect(passwordStrength("password123").level).toBe("weak"); // common
    expect(passwordStrength("riverstone8").level).toBe("fair");
    expect(passwordStrength("harbourview1984").level).toBe("good");
    expect(passwordStrength("Deck&Pergola-2026").level).toBe("strong");
    expect(passwordStrength("Deck&Pergola-2026").score).toBe(4);
    expect(PASSWORD_LEVEL_LABELS.fair).toBe("Fair");
  });

  it("ticks the checklist item by item", () => {
    expect(passwordStrength("riverstone8").checks).toEqual({ minLength: true, longEnough: false, mixed: false, notCommon: true, noPatterns: true });
    expect(passwordStrength("Deck&Pergola-2026").checks).toEqual({ minLength: true, longEnough: true, mixed: true, notCommon: true, noPatterns: true });
    expect(Object.values(PASSWORD_CHECK_LABELS)).toEqual(["At least 8 characters", "12 or more characters", "Letters, numbers and symbols", "Not a common password", "No repeats or sequences like aaaa or 1234"]);
  });

  it("spots repeats and sequences, either way round", () => {
    for (const pw of ["Harbour-aaaa-77!", "Harbour-1234-x!", "Harbour-4321-x!", "Harbour-dcba-x!", "Harbour-qwer-x!"]) expect(passwordStrength(pw).checks.noPatterns).toBe(false);
    expect(passwordStrength("Harbour-1357-x!").checks.noPatterns).toBe(true);
  });

  it("refuses only what the server refuses: under 8 characters, or a common password", () => {
    expect(passwordProblem("short")).toBe(PASSWORD_TOO_SHORT_MESSAGE);
    expect(passwordProblem("Password123")).toBe(PASSWORD_TOO_COMMON_MESSAGE);
    expect(isCommonPassword(" QWERTY123 ")).toBe(true);
    // Weak but not common is a warning, not a refusal.
    expect(passwordProblem("riverstone")).toBeNull();
  });
});
