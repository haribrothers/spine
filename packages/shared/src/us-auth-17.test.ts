import { describe, expect, it } from "vitest";
import { changeEmailSchema, deviceName, updateProfileSchema } from "./schemas/user-profile.ts";

describe("US-AUTH-17", () => {
  it("names each signed-in device from its user agent", () => {
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")).toBe("Chrome on macOS");
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")).toBe("Edge on Windows");
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
    expect(deviceName("Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0")).toBe("Firefox on Linux");
    expect(deviceName("Spine/1 CFNetwork/1568.100.1 Darwin/24.0.0")).toBe("Spine app on iPhone");
    expect(deviceName("okhttp/4.12.0")).toBe("Spine app on Android");
    expect(deviceName(null)).toBe("Unknown device");
  });
});

describe("US-AUTH-18", () => {
  it("takes the email only with the current password, never through the profile", () => {
    expect(updateProfileSchema.safeParse({ email: "new@example.com" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: "Priya" }).success).toBe(true);
    expect(changeEmailSchema.safeParse({ newEmail: " New@Example.com ", currentPassword: "x" })).toMatchObject({ success: true, data: { newEmail: "new@example.com" } });
    expect(changeEmailSchema.safeParse({ newEmail: "new@example.com", currentPassword: "" }).success).toBe(false);
  });
});
