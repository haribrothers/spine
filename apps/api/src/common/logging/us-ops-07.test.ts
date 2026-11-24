import { describe, expect, it } from "vitest";
import { loggablePath, redact } from "./redact";
import { runWithRequestId } from "./request-context";
import { SpineLogger } from "./spine-logger";

describe("US-OPS-07 · log every request with an id", () => {
  it("keeps passwords, tokens, secrets and cookies out of log text", () => {
    expect(redact('{"email":"priya@example.com","password":"hunter2-Secret"}')).toBe('{"email":"priya@example.com","password":[redacted]}');
    expect(redact("sent Bearer eyJhbGciOiJFZERTQSJ9.abc.def to the MCP endpoint")).toBe("sent Bearer [redacted] to the MCP endpoint");
    expect(redact("Authorization: Bearer eyJhbGciOiJFZERTQSJ9.abc.def")).not.toContain("eyJ");
    expect(redact("cookie better-auth.session_token=Bt1V0K3a3gjTaQ.XitxpVQaJ; theme=dark")).toBe("cookie better-auth.session_token=[redacted]; theme=dark");
    expect(redact("refresh_token=abc123&client_secret=s3cr3t")).toBe("refresh_token=[redacted]&client_secret=[redacted]");
    expect(redact("S3 key AKIA… apiKey: sk-live-998877")).toBe("S3 key AKIA… apiKey: [redacted]");
  });

  it("masks full card and bank numbers to their last four digits", () => {
    expect(redact("card 4111 1111 1111 1111 declined")).toBe("card ••••••••••••1111 declined");
    expect(redact("account 123456789012 at HDFC")).toBe("account ••••••••9012 at HDFC");
    expect(redact("IBAN GB82WEST12345698765432")).toBe("IBAN GB82••••5432");
  });

  it("leaves record ids, dates and short numbers readable", () => {
    const line = "Invoice 4f6a1c2e-1234-4b6f-8a9b-123456789012 for 125000 due 2026-10-23";
    expect(redact(line)).toBe(line);
  });

  it("logs a path without its query string, and without tokens in it", () => {
    expect(loggablePath("/files/abc?exp=1790000000&sig=deadbeef")).toBe("/files/abc");
    expect(loggablePath("/public/quotes/kq8Z2xV4pL0nR7tY3wB6sD1f")).toBe("/public/quotes/[token]");
    expect(loggablePath("/invoices/4f6a1c2e-1234-4b6f-8a9b-123456789012/issue")).toBe("/invoices/4f6a1c2e-1234-4b6f-8a9b-123456789012/issue");
  });

  it("writes one JSON line with time, level, the request id, context and the redacted message", () => {
    const lines: string[] = [];
    const logger = new SpineLogger("json", (l) => lines.push(l));
    runWithRequestId("req-12345678", () => logger.warn('login failed {"password":"x"}', "Auth"));
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line).toMatchObject({ level: "warn", requestId: "req-12345678", context: "Auth", message: 'login failed {"password":[redacted]}' });
    expect(new Date(line.time as string).toString()).not.toBe("Invalid Date");
  });

  it("a finished request is one JSON line with method, path, status and duration; 5xx is an error", () => {
    const lines: string[] = [];
    const logger = new SpineLogger("json", (l) => lines.push(l));
    logger.request({ requestId: "req-12345678", method: "POST", path: "/invoices", status: 500, durationMs: 12 });
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: "error", requestId: "req-12345678", method: "POST", path: "/invoices", status: 500, durationMs: 12 });
  });

  it("an error's stack is logged redacted", () => {
    const lines: string[] = [];
    const logger = new SpineLogger("json", (l) => lines.push(l));
    const err = new Error('insert failed: {"token":"abc"}');
    logger.error(err.message, err.stack, "ExceptionsHandler");
    const line = JSON.parse(lines[0]!) as { stack: string; message: string };
    expect(line.message).toBe('insert failed: {"token":[redacted]}');
    expect(line.stack).toContain("[redacted]");
    expect(line.stack).not.toContain('"abc"');
  });
});
