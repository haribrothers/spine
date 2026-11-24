import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";
import { formatFileSize } from "./schemas/attachments.ts";

describe("US-OPS-33", () => {
  it("history reads who attached which file", () => {
    const entry = { action: "attachment_added", entityType: "vendor_bill", actorName: "Sarah Mendes", changes: [{ field: "attachment", from: null, to: "coastal-timber-88213.pdf" }] };
    expect(describeHistoryEntry(entry, "this bill", "vendor_bill")).toBe("Sarah Mendes attached coastal-timber-88213.pdf");
  });

  it("file sizes read like 184 KB and 1.2 MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(184 * 1024)).toBe("184 KB");
    expect(formatFileSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
  });
});
