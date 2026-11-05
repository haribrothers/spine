import { describe, expect, it } from "vitest";
import { availableUpdate, isNewerVersion, updateNotice } from "./schemas/update-check";

describe("US-OPS-06 · which release counts as newer", () => {
  it("orders versions the semantic-version way, pre-releases before their release", () => {
    const ordered = ["1.0.0-beta.1", "1.0.0-beta.2", "1.0.0-beta.10", "1.0.0-rc.1", "1.0.0", "1.0.1", "1.1.0", "2.0.0"];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(isNewerVersion(ordered[i + 1]!, ordered[i]!)).toBe(true);
      expect(isNewerVersion(ordered[i]!, ordered[i + 1]!)).toBe(false);
    }
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("v1.1.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("latest", "1.0.0")).toBe(false);
  });

  it("offers the latest only when it's newer than this server", () => {
    expect(availableUpdate({ current: "1.0.0-beta.2", latest: "1.0.0" })).toBe("1.0.0");
    expect(availableUpdate({ current: "1.1.0", latest: "1.0.0" })).toBeNull();
    expect(availableUpdate({ current: "1.0.0" })).toBeNull();
    expect(availableUpdate(null)).toBeNull();
  });

  it("says what updating does", () => {
    expect(updateNotice("1.1.0", "1.0.0")).toEqual({
      title: "Spine 1.1.0 is available.",
      body: "You're on 1.0.0. Updating runs database migrations automatically and takes a backup first.",
    });
  });
});
