import { describe, expect, it } from "vitest";
import { MENU_ICONS } from "../lib/menu-icons";
import { generatePassword, passwordStrength } from "@spine/shared";

describe("US-TEAM-24", () => {
  it("suggests a strong password an Owner can read out, different each time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      expect(password).toMatch(/^[a-zA-Z]+-[a-zA-Z]+-\d\d-[a-zA-Z]+$/);
      expect(password).toMatch(/[A-Z]/);
      expect(passwordStrength(password).level).toBe("strong");
      seen.add(password);
    }
    expect(seen.size).toBeGreaterThan(45);
  });

  it("has its menu icon (D-222)", () => {
    expect(MENU_ICONS.changePassword).toBeTruthy();
  });
});
