import { describe, expect, it } from "vitest";
import { STORAGE_FULL_MESSAGE, storageWarningMessage } from "./storage.ts";

describe("US-OPS-31", () => {
  it("warns once the files volume is more than 85% full", () => {
    expect(storageWarningMessage(86)).toBe("Storage is 86% full. Free up space or add disk before uploads stop working.");
    expect(storageWarningMessage(99.6)).toBe("Storage is 100% full. Free up space or add disk before uploads stop working.");
  });

  it("says nothing at or below 85%, or when the driver can't tell", () => {
    expect(storageWarningMessage(85)).toBeNull();
    expect(storageWarningMessage(12)).toBeNull();
    expect(storageWarningMessage(null)).toBeNull();
  });

  it("words the full-disk upload error exactly", () => {
    expect(STORAGE_FULL_MESSAGE).toBe("There's no space left to store this file. Ask an owner to free up space.");
  });
});
