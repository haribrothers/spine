import { afterEach, describe, expect, it } from "vitest";
import { absoluteApiUrl } from "../lib/public-api-url";

describe("US-OPS-51", () => {
  const apiUrl = process.env.API_URL;
  afterEach(() => {
    if (apiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = apiUrl;
  });

  it("a release image's /api resolves against the page's own origin, so one image works on any domain", () => {
    expect(absoluteApiUrl("/api")).toBe(`${window.location.origin}/api`);
  });

  it("an absolute address, as in development, is used as it is", () => {
    expect(absoluteApiUrl("http://localhost:4000")).toBe("http://localhost:4000");
    expect(absoluteApiUrl(undefined)).toBe("http://localhost:4000");
  });
});
