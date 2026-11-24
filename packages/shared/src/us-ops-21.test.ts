import { describe, expect, it } from "vitest";
import { CAPABILITY_LABELS } from "./schemas/permissions.ts";

/** US-OPS-21 — the Team privilege matrix reads in plain language. */
const DEVELOPER_WORDING = /[a-z_]+\.[a-z_]+(?=\W|$)|\b[a-z]+_[a-z_]+\b|\bphase\s*\d|\(mobile\)|\bS-\d{2}\.\d+|§\d|\bFEAT-\d+|\.tsx?\b/i;

describe("US-OPS-21 · capability descriptions are plain language", () => {
  for (const [key, { label, description }] of Object.entries(CAPABILITY_LABELS)) {
    it(`${key}`, () => {
      expect(label).not.toMatch(DEVELOPER_WORDING);
      expect(description).not.toMatch(DEVELOPER_WORDING);
    });
  }
});
