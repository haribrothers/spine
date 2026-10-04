import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlidingWindowLimiter, resetPasswordUrl, sendResetPasswordEmail } from "./password-reset";

const sent: { to: string; subject: string; text: string }[] = [];
let configured = true;
let failing = false;

vi.mock("../modules/email/email.service", () => ({
  EmailService: class {
    isConfigured() {
      return configured;
    }
    async send(input: { to: string; subject: string; text: string }) {
      if (failing) throw new Error("SMTP down");
      sent.push(input);
    }
  },
}));

describe("US-AUTH-09 · ask for a password reset link", () => {
  beforeEach(() => {
    sent.length = 0;
    configured = true;
    failing = false;
  });

  it("emails a link to the web app's reset page with the token", async () => {
    const saved = process.env.APP_URL;
    process.env.APP_URL = "https://spine.example.test/";
    await sendResetPasswordEmail({ user: { email: "sam.lee@riverstone.test", name: "Sam" }, token: "tok123" });
    process.env.APP_URL = saved;
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("sam.lee@riverstone.test");
    expect(sent[0]!.text).toContain("https://spine.example.test/reset-password?token=tok123");
    expect(sent[0]!.text).toContain("The link works once and expires in 1 hour.");
  });

  it("sends nothing and doesn't throw when email (SMTP) isn't configured", async () => {
    configured = false;
    await expect(sendResetPasswordEmail({ user: { email: "no-smtp@riverstone.test", name: "Sam" }, token: "t" })).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("swallows an SMTP failure so the page's answer doesn't change", async () => {
    failing = true;
    await expect(sendResetPasswordEmail({ user: { email: "smtp-down@riverstone.test", name: "Sam" }, token: "t" })).resolves.toBeUndefined();
  });

  it("sends at most 3 emails an hour to one address, in any letter case", async () => {
    for (let i = 0; i < 5; i++) {
      await sendResetPasswordEmail({ user: { email: i % 2 ? "Busy@Riverstone.test" : "busy@riverstone.test", name: "Sam" }, token: `t${i}` });
    }
    expect(sent).toHaveLength(3);
  });

  it("the limiter frees a slot once the window has passed", () => {
    const limiter = new SlidingWindowLimiter({ max: 2, windowMs: 1000 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 10)).toBe(true);
    expect(limiter.hit("a", 20)).toBe(false);
    expect(limiter.hit("b", 20)).toBe(true);
    expect(limiter.hit("a", 1001)).toBe(true);
  });

  it("encodes the token in the link", () => {
    expect(resetPasswordUrl("a b", { APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000/reset-password?token=a%20b");
  });
});
