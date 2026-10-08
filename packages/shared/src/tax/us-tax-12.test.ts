import { describe, expect, it } from "vitest";
import {
  GSTIN_INVALID_MESSAGE,
  GST_STATES,
  GST_TREATMENTS,
  GST_TREATMENT_LABELS,
  gstStateLabel,
  gstinCheckCharacter,
  gstinError,
  gstinRequired,
  gstinStateCode,
  isUnionTerritory,
  isValidGstin,
  normaliseGstin,
} from "./gst.ts";

describe("US-TAX-12 · record my GSTIN and state, and each customer's", () => {
  it("checks a GSTIN's format and check character", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("29AAACK0000A1ZK")).toBe(true);
    expect(isValidGstin("29aaack0000a1zk")).toBe(true);
    expect(isValidGstin("29AAACK0000A1ZL")).toBe(false);
    expect(isValidGstin("29AAACK0000A1Z")).toBe(false);
    expect(isValidGstin("29AAACK00000AZK")).toBe(false);
    expect(isValidGstin("00AAACK0000A1ZK")).toBe(false);
    expect(gstinCheckCharacter("29AAACK0000A1Z")).toBe("K");
    expect(gstinError("29AAACK0000A1ZL")).toBe(GSTIN_INVALID_MESSAGE);
    expect(GSTIN_INVALID_MESSAGE).toBe("This GSTIN isn't valid — check the 15 characters.");
  });

  it("matches a GSTIN's first two digits to the state", () => {
    expect(gstinStateCode("29AAACK0000A1ZK")).toBe("29");
    expect(gstinError("29AAACK0000A1ZK", "29")).toBeNull();
    expect(gstinError("29AAACK0000A1ZK", "33")).toBe("This GSTIN belongs to Karnataka.");
    expect(gstStateLabel("29")).toBe("Karnataka (29)");
  });

  it("lists every state and union territory once, and knows which charge UTGST", () => {
    expect(new Set(GST_STATES.map((s) => s.code)).size).toBe(GST_STATES.length);
    expect(GST_STATES.find((s) => s.code === "33")?.name).toBe("Tamil Nadu");
    for (const ut of ["04", "26", "31", "35", "38"]) expect(isUnionTerritory(ut)).toBe(true);
    for (const st of ["07", "34", "29", "01"]) expect(isUnionTerritory(st)).toBe(false);
  });

  it("offers five GST treatments; registered and SEZ need a GSTIN", () => {
    expect(GST_TREATMENTS.map((t) => GST_TREATMENT_LABELS[t])).toEqual(["Registered business", "Unregistered business", "Consumer", "Overseas", "Special economic zone"]);
    expect(GST_TREATMENTS.filter(gstinRequired)).toEqual(["registered", "sez"]);
  });

  it("tidies a typed GSTIN", () => {
    expect(normaliseGstin(" 29aaack 0000a1zk ")).toBe("29AAACK0000A1ZK");
  });
});
